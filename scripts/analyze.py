import os
from pathlib import Path
import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy import stats
from tabulate import tabulate
from utils import ensure_dir

DATA_DIR = Path("data")
OUT_DIR = Path("reports")
ensure_dir(OUT_DIR)

def load_table(fp: Path) -> pd.DataFrame:
    if fp.suffix.lower() == ".csv":
        return pd.read_csv(fp)
    if fp.suffix.lower() in [".xls", ".xlsx"]:
        return pd.read_excel(fp)
    raise ValueError(f"Unsupported file: {fp}")

def basic_summary(df: pd.DataFrame) -> pd.DataFrame:
    return df.describe(include="all").T

def plot_hist(df: pd.DataFrame, col: str, out_png: Path):
    plt.figure()
    df[col].dropna().plot(kind="hist", bins=30)
    plt.title(f"{col} histogram")
    plt.xlabel(col); plt.ylabel("count")
    plt.tight_layout()
    plt.savefig(out_png, dpi=150)
    plt.close()

def maybe_ttest(df: pd.DataFrame, value_col: str, group_col: str):
    # 两组独立样本 t 检验（示例：control vs treatment）
    if group_col not in df.columns: 
        return None
    groups = df[group_col].dropna().unique()
    if len(groups) != 2: 
        return None
    g1, g2 = groups
    a = df.loc[df[group_col]==g1, value_col].dropna().astype(float)
    b = df.loc[df[group_col]==g2, value_col].dropna().astype(float)
    if len(a) < 3 or len(b) < 3: 
        return None
    t, p = stats.ttest_ind(a, b, equal_var=False)
    return {"group_a": str(g1), "group_b": str(g2), "t": float(t), "p": float(p)}

def analyze_file(fp: Path):
    name = fp.stem
    try:
        df = load_table(fp)
    except Exception as e:
        return {"file": str(fp), "status": "read_error", "error": str(e)}

    # 猜测几个常见列名（你可按你的数据改成固定列）
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    guessed_value_col = None
    for cand in ["kss", "score", "duration", "latency", "value"]:
        if cand in df.columns:
            guessed_value_col = cand
            break
    if not guessed_value_col and numeric_cols:
        guessed_value_col = numeric_cols[0]

    group_col = None
    for cand in ["condition", "group", "phase", "session"]:
        if cand in df.columns:
            group_col = cand
            break

    # 基础统计
    summary = basic_summary(df)
    out_summary = OUT_DIR / f"{name}_summary.csv"
    summary.to_csv(out_summary)

    # 画直方图（如果有数值列）
    out_plot = None
    if guessed_value_col:
        out_plot = OUT_DIR / f"{name}_{guessed_value_col}_hist.png"
        plot_hist(df, guessed_value_col, out_plot)

    # 可选 t 检验
    ttest_res = None
    if guessed_value_col and group_col:
        ttest_res = maybe_ttest(df, guessed_value_col, group_col)

    # 生成小结（md）
    lines = [
        f"### {fp.name}",
        f"- rows: {df.shape[0]}, cols: {df.shape[1]}",
        f"- value_col: `{guessed_value_col}`" if guessed_value_col else "- value_col: N/A",
        f"- group_col: `{group_col}`" if group_col else "- group_col: N/A",
        f"- summary: `{out_summary}`"
    ]
    if out_plot:
        lines.append(f"- plot: `{out_plot}`")
    if ttest_res:
        lines.append(f"- t-test: {ttest_res['group_a']} vs {ttest_res['group_b']}, "
                     f"t={ttest_res['t']:.3f}, p={ttest_res['p']:.3g}")
    return {
        "file": str(fp),
        "status": "ok",
        "report_md": "\n".join(lines),
        "plot": str(out_plot) if out_plot else None,
        "summary_csv": str(out_summary) if out_summary else None
    }

def main():
    files = sorted([p for p in DATA_DIR.glob("**/*") if p.suffix.lower() in [".csv", ".xls", ".xlsx"]])
    if not files:
        note = "No data files found in data/."
        Path("report_summary.json").write_text(json.dumps({"markdown": note}, ensure_ascii=False), encoding="utf-8")
        print(note); return

    blocks = ["## 🧪 Auto Analysis Report"]
    results = []
    for fp in files:
        res = analyze_file(fp)
        results.append(res)
        if res["status"] != "ok":
            blocks.append(f"- **{res['file']}** ❌ {res.get('error','')}")
        else:
            blocks.append(res["report_md"])
    md_all = "\n\n".join(blocks)
    # 存 Markdown 摘要，给工作流评论用
    Path("report_summary.json").write_text(json.dumps({"markdown": md_all}, ensure_ascii=False), encoding="utf-8")
    # 同时存完整报告
    (OUT_DIR / "REPORT.md").write_text(md_all, encoding="utf-8")
    print("Analysis finished.")

if __name__ == "__main__":
    main()
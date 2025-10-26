from pathlib import Path
import os, json, sys
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

DATA_DIR = Path("data")
OUT_DIR = Path("reports")
OUT_DIR.mkdir(parents=True, exist_ok=True)

def load_table(fp: Path) -> pd.DataFrame:
    if fp.suffix.lower() == ".csv":
        return pd.read_csv(fp)
    if fp.suffix.lower() in (".xls", ".xlsx"):
        return pd.read_excel(fp)
    if fp.suffix.lower() == ".json":
        return pd.read_json(fp)
    raise ValueError(f"Unsupported file: {fp.name}")

def first_numeric_col(df: pd.DataFrame) -> str | None:
    cols = df.select_dtypes(include="number").columns.tolist()
    return cols[0] if cols else None

def plot_hist(df: pd.DataFrame, col: str, out_png: Path):
    plt.figure()
    df[col].dropna().astype(float).plot(kind="hist", bins=30)
    plt.title(f"{col} histogram"); plt.xlabel(col); plt.ylabel("count")
    plt.tight_layout(); plt.savefig(out_png, dpi=150); plt.close()

def analyze_one(fp: Path) -> dict:
    name = fp.stem
    df = load_table(fp)

    # 概览统计
    summary_csv = OUT_DIR / f"{name}_summary.csv"
    df.describe(include="all").T.to_csv(summary_csv)

    # 选择一个数值列画图（如果有）
    png_path = None
    col = first_numeric_col(df)
    if col:
        png_path = OUT_DIR / f"{name}_{col}_hist.png"
        plot_hist(df, col, png_path)

    # 报告的一段 Markdown
    md = [
        f"### {fp.name}",
        f"- rows: **{df.shape[0]}**, cols: **{df.shape[1]}**",
        f"- numeric sample column: `{col}`" if col else "- numeric sample column: *N/A*",
        f"- summary: `reports/{summary_csv.name}`",
    ]
    if png_path:
        md.append(f"- hist: `reports/{png_path.name}`")
    return {
        "data_file": str(fp),
        "summary_csv": str(summary_csv) if summary_csv else None,
        "plot_png": str(png_path) if png_path else None,
        "report_md": "\n".join(md)
    }

def main():
    # 支持可选的单文件分析：通过环境变量 FILE=xxx.csv 传入
    only = os.getenv("FILE", "").strip()
    targets = []
    if only:
        p = DATA_DIR / only
        if not p.exists():
            print(f"[WARN] {p} not found under data/. Fallback to all files.")
        else:
            targets = [p]

    if not targets:
        targets = [p for p in DATA_DIR.glob("**/*") if p.suffix.lower() in (".csv",".xls",".xlsx",".json")]

    if not targets:
        note = "No data files in data/. Nothing to analyze."
        print(note)
        Path("report_summary.json").write_text(json.dumps({"markdown": note}, ensure_ascii=False), encoding="utf-8")
        return

    blocks = ["## 🧪 Auto Analysis Report"]
    outputs = []
    for fp in targets:
        try:
            res = analyze_one(fp)
            outputs.append(res)
            blocks.append(res["report_md"])
        except Exception as e:
            blocks.append(f"- **{fp.name}** ❌ {e}")

    # 汇总报告
    report_md = "\n\n".join(blocks)
    (OUT_DIR / "REPORT.md").write_text(report_md, encoding="utf-8")
    Path("report_summary.json").write_text(json.dumps({"markdown": report_md, "items": outputs}, ensure_ascii=False), encoding="utf-8")
    print("Analysis finished.")
    
if __name__ == "__main__":
    main()

from pathlib import Path
import os, json, sys, re, argparse
import pandas as pd
import numpy as np

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import shutil

# Define directories first
ROOT_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT_DIR / "reports"
DATA_DIR = ROOT_DIR / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)


# Optional cleaning step
CLEAN = os.getenv("CLEAN", "1") == "1"   # CLEAN=0 to keep old files
if CLEAN and OUT_DIR.exists():
    for p in OUT_DIR.iterdir():
        # Keep REPORT.md (skip deleting)
        if p.is_file() and p.name == "REPORT.md":
            continue
        if p.is_dir():
            shutil.rmtree(p)
        else:
            p.unlink()
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Detect column names that look like identifiers rather than data fields
ID_LIKE_PATTERN = re.compile(
    r'(?:^|_)(id|uuid|index|sampleid|subjectid|recordid|caseid|patientid)(?:$|_)',
    re.IGNORECASE)

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
    
# return (the list of retained columns, the dictionary of skipped reasons), and sort by missing rate (low-high);support the upper limit of limit
def numeric_cols(df: pd.DataFrame, limit: int | None = None) -> tuple[list[str], dict[str, str]]:
    skipped: dict[str, str] = {}
    candidates: list[str]=[]
    
    #numeric columns
    num_cols = df.select_dtypes(include="number").columns.tolist()
    n_rows = len(df)

    for col in num_cols:
        s = pd.to_numeric(df[col], errors="coerce")
        s_non = s.dropna()

        if s_non.empty:
            skipped[col] = "all-NaN"
            continue
        if s_non.nunique(dropna=True) <=1:
            skipped[col] = "constant"
            continue
        looks_like_id = bool(ID_LIKE_PATTERN.search(col))
        is_intish = (pd.api.types.is_integer_dtype(s_non) or np.all(np.floor(s_non) == s_non))
        unique_ratio = s_non.nunique() / max(len(s_non), 1)
        is_monotonic_index = is_intish and (s_non.is_monotonic_increasing or s_non.is_monotonic_decreasing)
        
        #Interger sequence and like numbering(high uniqueness/monotonicity)/column names resemble IDs
        if (looks_like_id and (unique_ratio > 0.5 or is_intish)) or (is_intish and (unique_ratio > 0.8 or is_monotonic_index)):
            skipped[col] = "likely-ID/index"
            continue

        candidates.append(col)

    candidates.sort(key=lambda c:df[c].isna().mean())

    if limit and limit > 0:
        candidates = candidates[:limit]
    return candidates, skipped

def plot_hist(df: pd.DataFrame, col: str, out_png: Path):
    plt.figure()
    df[col].dropna().astype(float).plot(kind="hist", bins=30)
    plt.title(f"{col} histogram")
    plt.xlabel(col)
    plt.ylabel("count")
    plt.tight_layout()
    plt.savefig(out_png, dpi=150)
    plt.close()
    
def analyze_one(fp: Path, n_limit: int | None = None) -> dict:
    name = fp.stem
    df = load_table(fp)

    # overview statistics
    summary_csv = OUT_DIR / f"{name}_summary.csv"
    df.describe(include="all").T.to_csv(summary_csv)

    # select analyzable columns (automatic rule + upper limit)
    cols, skipped = numeric_cols(df, limit=n_limit)

    # print the reason for skipping (to console)
    for col, reason in skipped.items():
        print(f"[SKIP] {fp.name} :: {col} -> {reason}")

    if not cols:
        print(f"[WARN] {fp.name}: no analyzable numeric columns after filtering.")

    #draw
    pngs = []
    for col in cols:
        out_png = OUT_DIR / f"{name}_{col}_hist.png"
        try:
            plot_hist(df, col, out_png)
            pngs.append(out_png.name)
        except Exception as e:
            pngs.append(f"(failed: {col} -> {e})")
            
    # Report (adding the numeric clumns: hint + more）
    lines = [
        f"### {fp.name}",
        f"- rows: **{df.shape[0]}**, cols: **{df.shape[1]}**",
        f"- numeric columns: `{', '.join(cols)}`",
        f"- summary: `reports/{summary_csv.name}`",
        "",
        "#### Distributions",
    ]
    for p in pngs:
        if p.endswith(".png"):
            lines.append(f"![](./{p})")
        else:
            lines.append(f"- {p}")

    return {
        "data_file": str(fp),
        "summary_csv": str(summary_csv),
        "plots": pngs,
        "report_md": "\n".join(lines),
    }

def main():
    # Supports optional single-file analysis, can be passed through the environment variable FILE=xxx.csv
    # 2025-10-28, adding --n
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=0, help="Maximum number of columns to analyze；0 means all available numeric columns.")
    args, _ = parser.parse_known_args()
    n_limit = None if args.n == 0 else args.n

    only = os.getenv("FILE", "").strip()
    targets = []
    if only:
        p = DATA_DIR / only
        if not p.exists():
            print(f"[WARN] {p} not found under data/. Fallback to all files.")
        else:
            targets = [p]

    if not targets:
        targets = [p for p in DATA_DIR.glob("**/*") if p.suffix.lower() in (".csv", ".xls", ".xlsx", ".json")]

    if not targets:
        note = "No data files in data/. Nothing to analyze."
        print(note)
        Path("report_summary.json").write_text(json.dumps({"markdown": note}, ensure_ascii=False), encoding="utf-8")
        return

    targets = sorted(targets, key=lambda x: str(x))
    print("Targets:", [str(p) for p in targets])

    blocks = ["## 🧪 Auto Analysis Report"]
    outputs = []
    for fp in targets:
        try:
            # inner analyze_one() generate summary_csv / plots，back report_md..
            res = analyze_one(fp, n_limit=n_limit)  # 2025-10-28, adding n_limit
            # Convert all Path to strings to ensure JSON serialization is possible.
            res["data_file"] = str(res.get("data_file", fp))
            if "summary_csv" in res:
                res["summary_csv"] = str(res["summary_csv"])
            if "plots" in res:
                res["plots"] = [str(p) for p in res["plots"]]
            outputs.append(res)
            blocks.append(res["report_md"])
        except Exception as e:
            blocks.append(f"- **{fp.name}** ❌ {e}")

    report_md = "\n\n".join(blocks)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "REPORT.md").write_text(report_md, encoding="utf-8")
    Path("report_summary.json").write_text(
        json.dumps({"markdown": report_md, "items": outputs}, ensure_ascii=False),
        encoding="utf-8"
    )

    # 2025-10-28, generating Quarkdown (.qd)
    from textwrap import dedent
    qd = dedent(f"""\
.docname {{Noema Report}}
.doctype {{plain}}
.theme {{darko}}

# Auto Analysis Summary (generated by Noema-Bot)
.tableofcontents

{report_md}
""")
    (OUT_DIR / "noema-report.qd").write_text(qd, encoding="utf-8")
    print("Writing QD to:", (OUT_DIR / "noema-report.qd"))

    # generate Dashboard（from outputs）
    dashboard_qd = build_dashboard(outputs)
    (OUT_DIR / "dashboard.qd").write_text(dashboard_qd, encoding="utf-8")
    print("Writing QD to:", (OUT_DIR / "dashboard.qd"))

    print("Analysis finished.")
    print("== DEBUG FILE CHECK ==")
    for f in OUT_DIR.glob("*.qd"):
        print("Found QD:", f)
    print("== OUT_DIR contents ==")
    for f in OUT_DIR.iterdir():
        print(" -", f)


# --- helpers (top-level, no indent!) ---

def _slugify_anchor(name: str) -> str:
    import re
    return re.sub(r'[^A-Za-z0-9_-]+', '_', name).strip('_')


def build_dashboard(outputs: list) -> str:
    
    from textwrap import dedent
    cards = []

    for item in outputs:
        try:
            data_name = Path(item["data_file"]).name
            anchor = _slugify_anchor(Path(item["data_file"]).stem)  

            thumb = ""
            for p in item.get("plots", []):
                if str(p).lower().endswith(".png"):
                    thumb = Path(p).name 
                    break

            md_lines = [
                f"### {data_name}",
                f"Summary: `{Path(item.get('summary_csv', '')).name}`" if item.get("summary_csv") else "_No summary table._",
                f"[Open full report →](index.html#{anchor})",
            ]
            if thumb:
                md_lines.append(f"![](./{thumb})")

            cards.append("\n\n".join(md_lines))
        except Exception as _:
            continue

    dashboard_qd = dedent(f"""\
.docname {{Noema-Bot Dashboard}}
.doctype {{plain}}
.theme {{darko}}

# 🧭 Report Index

This dashboard lists all analyzed datasets. Click *Open full report* to jump into the full analysis.

{chr(10).join(cards) if cards else "_No datasets found._"}
""")
    return dashboard_qd


if __name__ == "__main__":
    main()

from pathlib import Path
import os, json, re, argparse, shutil
import pandas as pd
import numpy as np

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# ------------------------------
# Paths
# ------------------------------
ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
OUT_DIR  = ROOT_DIR / "reports"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ------------------------------
# Optional cleaning
# ------------------------------
CLEAN = os.getenv("CLEAN", "1") == "1"   # CLEAN=0 to keep old files
if CLEAN and OUT_DIR.exists():
    for p in OUT_DIR.iterdir():
        # keep these for stability
        if p.name in {"REPORT.md", "noema-report.qd", "dashboard.qd", ".nojekyll"}:
            continue
        if p.is_dir():
            shutil.rmtree(p)
        else:
            p.unlink()
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ------------------------------
# Heuristics
# ------------------------------
ID_LIKE_PATTERN = re.compile(
    r'(?:^|_)(id|uuid|index|sampleid|subjectid|recordid|caseid|patientid)(?:$|_)',
    re.IGNORECASE
)

def load_table(fp: Path) -> pd.DataFrame:
    suf = fp.suffix.lower()
    if suf == ".csv":
        return pd.read_csv(fp)
    if suf in (".xls", ".xlsx"):
        return pd.read_excel(fp)
    if suf == ".json":
        return pd.read_json(fp)
    raise ValueError(f"Unsupported file: {fp.name}")

def numeric_cols(df: pd.DataFrame, limit: int | None = None) -> tuple[list[str], dict[str, str]]:
    """Pick numeric columns likely to be true measures (not IDs).
       Returns (kept_columns, skipped_reason_dict)."""
    skipped: dict[str, str] = {}
    candidates: list[str] = []

    num_cols = df.select_dtypes(include="number").columns.tolist()

    for col in num_cols:
        s = pd.to_numeric(df[col], errors="coerce")
        s_non = s.dropna()

        if s_non.empty:
            skipped[col] = "all-NaN"
            continue
        if s_non.nunique(dropna=True) <= 1:
            skipped[col] = "constant"
            continue

        looks_like_id = bool(ID_LIKE_PATTERN.search(col))
        is_intish = (pd.api.types.is_integer_dtype(s_non) or np.all(np.floor(s_non) == s_non))
        unique_ratio = s_non.nunique() / max(len(s_non), 1)
        is_monotonic_index = is_intish and (s_non.is_monotonic_increasing or s_non.is_monotonic_decreasing)

        # ID-like name + high uniqueness / integer sequence
        if (looks_like_id and (unique_ratio > 0.5 or is_intish)) or \
           (is_intish and (unique_ratio > 0.8 or is_monotonic_index)):
            skipped[col] = "likely-ID/index"
            continue

        candidates.append(col)

    # missing rate low -> high
    candidates.sort(key=lambda c: df[c].isna().mean())

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

    # select analyzable columns
    cols, skipped = numeric_cols(df, limit=n_limit)

    for col, reason in skipped.items():
        print(f"[SKIP] {fp.name} :: {col} -> {reason}")
    if not cols:
        print(f"[WARN] {fp.name}: no analyzable numeric columns after filtering.")

    # plots -> reports/*.png
    pngs: list[str] = []
    for col in cols:
        out_png = OUT_DIR / f"{name}_{col}_hist.png"
        try:
            plot_hist(df, col, out_png)
            pngs.append(out_png.name)  # store file name only (relative to reports/)
        except Exception as e:
            pngs.append(f"(failed: {col} -> {e})")

    SHOW_SUMMARY_PREVIEW = os.getenv("SHOW_SUMMARY", "0") == "1"
    summary_csv_name = Path(summary_csv).name

    lines = [
        f"### {fp.name}",
        f"- rows: **{df.shape[0]}**, cols: **{df.shape[1]}**",
        f"- numeric columns: `{', '.join(cols) if cols else '—'}`",
        f"- summary: [{summary_csv_name}](./{summary_csv_name})",
        "",
        "#### Distributions",
    ]
    for nm in pngs:
        if str(nm).endswith(".png"):
            lines.append(f"![](./{nm})")
        else:
            lines.append(f"- {nm}")

    if SHOW_SUMMARY_PREVIEW:
        try:
            _df_preview = pd.read_csv(summary_csv, nrows=15)
            _html = _df_preview.to_html(index=False, border=0, escape=False)
            lines += [
                "",
                "<details>",
                "<summary><b>Preview summary table</b> (top 15 rows) — click to expand</summary>",
                "",
                _html,
                "",
                "</details>",
                ""
            ]
        except Exception as _e:
            lines.append(f"_Summary preview unavailable: {type(_e).__name__}: {str(_e)}_")

    return {
        "data_file": str(fp),
        "summary_csv": str(summary_csv),
        "plots": [str(p) for p in pngs],
        "report_md": "\n".join(lines),
    }

# --- helpers (top-level, no indent!) ---
def _qd_anchor_from_heading(text: str) -> str:
    import re
    return re.sub(r'[^a-z0-9]+', '', text.lower())

def build_dashboard(outputs: list) -> str:
    from textwrap import dedent

    cards = []
    for item in outputs:
        try:
            data_name = Path(item["data_file"]).name
            anchor = _qd_anchor_from_heading(data_name)
            link = f"[Open full report →](./report.html#{anchor})"

            thumb = next(
                (Path(p).name for p in item.get("plots", []) if str(p).lower().endswith(".png")),
                ""
            )
            md = [
                f"### {data_name}",
                f"Summary: {Path(item.get('summary_csv','')).name}" if item.get("summary_csv") else "_No summary table._",
                link,
            ]
            if thumb:
                md.append(f"![](./{thumb})")
            cards.append("\n\n".join(md))
        except Exception as e:
            cards.append(f"- _Dashboard item failed for **{item.get('data_file','?')}** — {type(e).__name__}: {e}_")

    joined = "\n".join(cards) if cards else "_No datasets found._"

    return dedent(
        """
.docname {Noema-Bot Dashboard}
.doctype {plain}
.theme {darko}

# 🧭 Report Index

This dashboard lists all analyzed datasets. Click *Open full report* to jump into the full analysis.

"""
        + joined
    )

def main():
    # CLI
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=0, help="Maximum number of columns to analyze; 0 means all available numeric columns.")
    args, _ = parser.parse_known_args()
    n_limit = None if args.n == 0 else args.n

    # FILE env (single-file mode)
    only = os.getenv("FILE", "").strip()
    targets: list[Path] = []
    if only:
        p = DATA_DIR / only
        if not p.exists():
            print(f"[WARN] {p} not found under data/. Fallback to all files.")
        else:
            targets = [p]

    if not targets:
        targets = [p for p in DATA_DIR.glob("**/*") if p.suffix.lower() in (".csv", ".xls", ".xlsx", ".json")]

    # --- No data fallback: still emit minimal artifacts so Quarkdown step never falls back ---
    if not targets:
        note = "No data files in data/. Nothing to analyze."
        print(note)
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        (OUT_DIR / "REPORT.md").write_text(note, encoding="utf-8")

        qd_min = """\
.docname {Noema Report}
.doctype {plain}
.theme {darko}

# No Data Found
_No data files in data/. Nothing to analyze._
"""
        (OUT_DIR / "noema-report.qd").write_text(qd_min, encoding="utf-8")
        (OUT_DIR / "dashboard.qd").write_text(qd_min, encoding="utf-8")

        Path("report_summary.json").write_text(json.dumps({"markdown": note}, ensure_ascii=False), encoding="utf-8")
        return

    # --- Normal run ---
    targets = sorted(targets, key=lambda x: str(x))
    print("Targets:", [str(p) for p in targets])

    blocks = ["## 🧪 Auto Analysis Report"]
    outputs = []
    for fp in targets:
        try:
            res = analyze_one(fp, n_limit=n_limit)
            # normalize
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

    # Quarkdown (.qd)
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

    # Dashboard
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

if __name__ == "__main__":
    main()

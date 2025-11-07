#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations
import argparse
import os
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any
import json
import re

import pandas as pd
import numpy as np

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
REPORTS_DIR = ROOT / "reports"
IMG_DIR = REPORTS_DIR / "img"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
IMG_DIR.mkdir(parents=True, exist_ok=True)


def find_files(file_arg: str) -> List[Path]:
    """Resolve files to analyze. If file_arg is empty -> all CSV under data/."""
    files: List[Path] = []
    if file_arg:
        # allow raw name or path under data/
        p = Path(file_arg)
        if not p.is_absolute():
            p = (DATA_DIR / file_arg).resolve()
        if p.exists() and p.suffix.lower() == ".csv":
            files = [p]
        else:
            print(f"[warn] file not found or not CSV: {p}")
    else:
        files = sorted(DATA_DIR.glob("*.csv"))
    return files


def read_concat(files: List[Path]) -> Tuple[pd.DataFrame, List[pd.DataFrame]]:
    """Read CSV files and concat (row-wise). Empty -> empty DF."""
    frames: List[pd.DataFrame] = []
    for fp in files:
        try:
            df = pd.read_csv(fp)
            df["__source_file__"] = fp.name
            frames.append(df)
            print(f"[load] {fp} -> shape={df.shape}")
        except Exception as e:
            print(f"[warn] failed reading {fp}: {e}")

    if frames:
        df_all = pd.concat(frames, axis=0, ignore_index=True)
    else:
        df_all = pd.DataFrame()

    return df_all, frames


def safe_shape(df: Optional[pd.DataFrame], frames: Optional[List[pd.DataFrame]] = None) -> Tuple[int, int]:
    """Return (rows, cols), robust even if df is None/invalid."""
    try:
        if isinstance(df, pd.DataFrame):
            r, c = df.shape
            return int(r), int(c)
    except Exception:
        pass

    if frames:
        try:
            tmp = pd.concat(frames, axis=0, ignore_index=True)
            r, c = tmp.shape
            return int(r), int(c)
        except Exception:
            pass
    return (0, 0)


def numeric_cols(df: pd.DataFrame) -> List[str]:
    if df is None or df.empty:
        return []
    num = df.select_dtypes(include=[np.number]).columns.tolist()
    # drop the helper col if numeric by accident
    return [c for c in num if c != "__source_file__"]


def plot_numeric_histograms(df: pd.DataFrame, cols: List[str], n_limit: int) -> List[str]:
    """Return list of saved image paths (relative to reports/)."""
    saved = []
    if not cols:
        return saved
    if n_limit and n_limit > 0:
        cols = cols[: n_limit]

    for col in cols:
        try:
            series = pd.to_numeric(df[col], errors="coerce").dropna()
            if series.empty:
                continue
            plt.figure(figsize=(6, 4))
            plt.hist(series, bins=30)
            plt.title(f"Histogram: {col}")
            plt.xlabel(col)
            plt.ylabel("Count")
            out = IMG_DIR / f"hist_{re.sub(r'[^A-Za-z0-9_]+','_', col)}.png"
            plt.tight_layout()
            plt.savefig(out)
            plt.close()
            saved.append(str(out.relative_to(REPORTS_DIR)))
            print(f"[plot] {col} -> {out}")
        except Exception as e:
            print(f"[warn] failed plotting {col}: {e}")
    return saved


def md_escape(text: str) -> str:
    return str(text).replace("<", "&lt;").replace(">", "&gt;")


def build_markdown_summary(targets: List[Path], df: pd.DataFrame, frames: List[pd.DataFrame], img_rel: List[str], n_limit: int) -> str:
    rows, cols = safe_shape(df, frames)
    tgt_list = ", ".join([f"`{t.name}`" for t in targets]) if targets else "_<none>_"
    lines = []
    lines.append(f"**Targets:** [{tgt_list}]")
    lines.append(f"**Rows:** **{rows}**, **Cols:** **{cols}**  ")
    if df is not None and not df.empty:
        lines.append(f"**Numeric columns found:** {len(numeric_cols(df))}")
        if n_limit and n_limit > 0:
            lines.append(f"**Plotted (limit n):** {n_limit}")
    else:
        lines.append("_No data loaded; generated empty report._")

    if img_rel:
        lines.append("\n**Figures:**")
        for rel in img_rel:
            lines.append(f"![](./{rel})")
    return "\n".join(lines)


def write_qd_files(summary_md: str, title: str = "Noema Report") -> None:
    """Create minimal, valid .qd files that Quarkdown can compile."""
    noema_qd = f"""---
title: {md_escape(title)}
author: Noema-Bot
---

# Summary

{summary_md}

---

# Notes

- This is an auto-generated report.
- Edit `scripts/analyze.py` to customize sections & visuals.

"""
    (REPORTS_DIR / "noema-report.qd").write_text(noema_qd, encoding="utf-8")

    dashboard_qd = f"""---
title: Noema Dashboard
author: Noema-Bot
---

# Dashboard

- [Full report](./report.html)
- Raw summary is embedded below.

## Quick Summary

{summary_md}

"""
    (REPORTS_DIR / "dashboard.qd").write_text(dashboard_qd, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=0, help="Max numeric columns to plot (0 = all)")
    parser.add_argument("--file", type=str, default="", help="Optional CSV file under data/ (empty = auto)")
    args = parser.parse_args()

    files = find_files(args.file)
    print(f"Targets: {[str(p.relative_to(ROOT)) if p.exists() else str(p) for p in files]}")
    df, frames = read_concat(files)

    # plots
    nums = numeric_cols(df)
    img_rel = plot_numeric_histograms(df, nums, args.n)

    # markdown summary
    summary_md = build_markdown_summary(files, df, frames, img_rel, args.n)
    (REPORTS_DIR / "REPORT.md").write_text(summary_md, encoding="utf-8")

    # JSON summary for workflow comment step
    summary_json: Dict[str, Any] = {"markdown": summary_md}
    Path(ROOT / "report_summary.json").write_text(json.dumps(summary_json, ensure_ascii=False, indent=2), encoding="utf-8")

    # QD files for Quarkdown compile
    write_qd_files(summary_md, title="Noema Analysis Report")

    print("Writing QD to: reports/noema-report.qd")
    print("Done.")


if __name__ == "__main__":
    main()

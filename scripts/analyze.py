#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations
import argparse
import os
import sys
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any
import json
import re

import pandas as pd
import numpy as np

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# SETUP PATHS

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
REPORTS_DIR = ROOT / "reports"
IMG_DIR = REPORTS_DIR / "img"

# Ensure directories exist
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
IMG_DIR.mkdir(parents=True, exist_ok=True)


def find_files(file_arg: str) -> List[Path]:
    """
    Resolve files to analyze.
    - If file_arg is provided: MUST exist, or we raise an error.
    - If file_arg is empty: Return all .csv files in data/.
    """
    files: List[Path] = []
    
    if file_arg:
        # Strip potential quotes or whitespace
        clean_name = file_arg.strip().strip("'").strip('"')
        
        # Try finding the file in DATA_DIR
        candidate = DATA_DIR / clean_name
        
        # Fallback: maybe user passed "data/filename.csv" explicitly
        if not candidate.exists():
            candidate = ROOT / clean_name
            
        if candidate.exists() and candidate.suffix.lower() == ".csv":
            files = [candidate]
        else:
            # CRITICAL: Fail hard if user specified a file that doesn't exist
            print(f"::error::File not found or not CSV: {clean_name}")
            sys.exit(1)
    else:
        # Auto-discovery
        files = sorted(DATA_DIR.glob("*.csv"))
        if not files:
            print("::warning::No CSV files found in data/ directory.")
            
    return files


def read_concat(files: List[Path]) -> Tuple[pd.DataFrame, List[pd.DataFrame]]:
    """Read CSV files and concat (row-wise)."""
    frames: List[pd.DataFrame] = []
    for fp in files:
        try:
            df = pd.read_csv(fp)
            df["__source_file__"] = fp.name
            frames.append(df)
            print(f"[load] {fp.name} -> shape={df.shape}")
        except Exception as e:
            print(f"::error::Failed reading {fp.name}: {e}")

    if frames:
        df_all = pd.concat(frames, axis=0, ignore_index=True)
    else:
        df_all = pd.DataFrame()

    return df_all, frames


def numeric_cols(df: pd.DataFrame) -> List[str]:
    if df is None or df.empty:
        return []
    # select only number columns
    num = df.select_dtypes(include=[np.number]).columns.tolist()
    # exclude our helper column if it somehow became numeric
    return [c for c in num if c != "__source_file__"]


def plot_numeric_histograms(df: pd.DataFrame, cols: List[str], n_limit: int) -> List[str]:
    """Generate histograms and return relative paths for Markdown."""
    saved_paths = []
    if not cols or df.empty:
        return saved_paths

    # Limit number of plots if n > 0
    targets = cols[:n_limit] if (n_limit and n_limit > 0) else cols

    for col in targets:
        try:
            series = pd.to_numeric(df[col], errors="coerce").dropna()
            if series.empty:
                continue
            
            plt.figure(figsize=(6, 4))
            plt.hist(series, bins=30, color="#4e79a7", edgecolor="black", alpha=0.7)
            plt.title(f"Histogram: {col}")
            plt.xlabel(col)
            plt.ylabel("Frequency")
            plt.grid(axis='y', alpha=0.3)
            
            # Safe filename
            safe_name = re.sub(r'[^A-Za-z0-9_]+', '_', col)
            out_path = IMG_DIR / f"hist_{safe_name}.png"
            
            plt.tight_layout()
            plt.savefig(out_path, dpi=100)
            plt.close() # Free memory
            
            # Store path relative to reports/ for the MD/QD file
            # e.g. "img/hist_Age.png"
            rel_path = out_path.relative_to(REPORTS_DIR).as_posix()
            saved_paths.append(rel_path)
            print(f"[plot] Generated: {rel_path}")
            
        except Exception as e:
            print(f"[warn] Failed plotting {col}: {e}")
            
    return saved_paths


def build_markdown_summary(targets: List[Path], df: pd.DataFrame, img_rel: List[str], n_limit: int) -> str:
    """Construct the summary text for Issue Comment and Report."""
    if df is None or df.empty:
        return "⚠️ **Analysis Failed:** No data was loaded."

    rows, cols = df.shape
    tgt_names = ", ".join([f"`{t.name}`" for t in targets])
    
    num_cols = numeric_cols(df)
    
    lines = []
    lines.append(f"**Data Sources:** {tgt_names}")
    lines.append(f"**Dimensions:** {rows} rows × {cols} columns")
    lines.append(f"**Numeric Columns:** {len(num_cols)}")
    
    if n_limit > 0 and len(num_cols) > n_limit:
        lines.append(f"*(Plots limited to first {n_limit} columns)*")

    if img_rel:
        lines.append("\n### 📊 Visualizations")
        for rel in img_

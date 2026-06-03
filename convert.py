#!/usr/bin/env python3
"""
convert.py
----------
Converts a multi-page PDF document into individual high-resolution PNG page images.
Uses pdf2image (which relies on system-level poppler / pdftoppm).

Usage:
    python convert.py input.pdf output_dir
"""

import sys
import os
from pdf2image import convert_from_path

def convert_pdf_to_images(pdf_path: str, out_dir: str, dpi: int = 300) -> list[str]:
    """Converts a PDF file to a set of PNG images, one per page."""
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"Input PDF not found: {pdf_path}")
    
    os.makedirs(out_dir, exist_ok=True)
    print(f"Converting '{pdf_path}' at {dpi} DPI...")
    
    images = convert_from_path(pdf_path, dpi=dpi)
    png_paths = []
    
    for i, img in enumerate(images):
        p = os.path.join(out_dir, f"page_{i+1}.png")
        img.save(p, "PNG")
        png_paths.append(p)
        print(f"  Saved page {i+1} to {p}")
        
    print(f"Conversion complete. Total pages converted: {len(png_paths)}")
    return png_paths

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python convert.py input.pdf output_dir")
        sys.exit(1)
        
    pdf_in = sys.argv[1]
    out_dir = sys.argv[2]
    try:
        convert_pdf_to_images(pdf_in, out_dir)
    except Exception as e:
        print(f"ERROR: {e}")
        print("\nNote: Make sure poppler is installed on your system.")
        print("For macOS: brew install poppler")
        sys.exit(1)

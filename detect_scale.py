"""
detect_scale.py
---------------
Reads a schematic PNG and extracts the drawing scale from the title block using OCR.

Recognised format:  N/D" = 1'-0"   (e.g. 1/8"=1'-0"  or  1/4"=1'-0")
                    also handles    1" = 1'-0"  (whole-number numerator)

Returns pixels-per-foot and pixels-per-meter for the given DPI.

Usage (standalone):
    python detect_scale.py page_0.png          # auto-detect DPI=300
    python detect_scale.py page_0.png --dpi 150

Import usage:
    from detect_scale import detect_scale
    result = detect_scale("page_0.png", dpi=300)
    print(result)
    # {'raw': "1/8\"=1'-0\"", 'paper_inches': 0.125,
    #  'real_feet': 1.0, 'pixels_per_foot': 37.5, 'pixels_per_meter': 123.03}
"""

import sys
import os
import re
import argparse
import textwrap

import cv2
import numpy as np
import pytesseract

# Ensure UTF-8 on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# --------------------------------------------------------------------------- #
# Tesseract path candidates (Windows and macOS default install locations)
# --------------------------------------------------------------------------- #
from pathlib import Path
_TESS_CANDIDATES = [
    "/opt/homebrew/bin/tesseract",
    "/usr/local/bin/tesseract",
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    rf"C:\Users\{os.environ.get('USERNAME','')}\AppData\Local\Programs\Tesseract-OCR\tesseract.exe",
]
for _p in _TESS_CANDIDATES:
    if Path(_p).exists():
        pytesseract.pytesseract.tesseract_cmd = _p
        break


# --------------------------------------------------------------------------- #
# Scale regex
# --------------------------------------------------------------------------- #
# Matches patterns like:
#   1/8"=1'-0"   1/4" = 1'-0"   3/16"=1'-0"   1"=1'-0"
#   also tolerates OCR noise around the quote/apostrophe characters

_SCALE_RE = re.compile(
    r"""
    (?P<num>\d+)            # numerator  (e.g. 1)
    (?:/(?P<den>\d+))?      # optional /denominator  (e.g. /8); absent => whole inch
    \s*[""'"'`]\s*          # inch mark after paper measurement
    \s*[=:]\s*              # equals / colon separator
    \s*(?P<feet>\d+)        # real feet  (almost always 1)
    \s*[''`']\s*            # foot mark
    (?:[-–]\s*              # optional dash before inches  (the -0")
    (?P<inches>\d+)         # real inches  (almost always 0)
    \s*[""'"'`])?           # closing inch mark
    """,
    re.VERBOSE | re.IGNORECASE,
)

# --------------------------------------------------------------------------- #
# Image regions to search  (defined as fractions of image dimensions)
# Title blocks appear in corners – we search all four corners and edge strips.
# NOTE: no full-image region – too slow on large 300-DPI scans.
# --------------------------------------------------------------------------- #
# Each entry: (y_start_frac, y_end_frac, x_start_frac, x_end_frac, label)
_SEARCH_REGIONS = [
    (0.00, 0.12, 0.55, 1.00, "top-right"),
    (0.00, 0.12, 0.00, 0.45, "top-left"),
    (0.88, 1.00, 0.55, 1.00, "bottom-right"),
    (0.88, 1.00, 0.00, 0.45, "bottom-left"),
    (0.00, 0.08, 0.00, 1.00, "top-strip"),
    (0.92, 1.00, 0.00, 1.00, "bottom-strip"),
    (0.00, 0.20, 0.60, 1.00, "top-right-wide"),
    (0.80, 1.00, 0.60, 1.00, "bottom-right-wide"),
]

# Maximum pixel dimension for a region before we skip 2x upscale
_MAX_DIM_FOR_UPSCALE = 900   # px

# Tesseract configs to try
_TESS_CONFIGS = [
    "--psm 6",
    "--psm 11",
    "--psm 3",
]

# Rotations to try per region (degrees); 180 catches upside-down title blocks
_ROTATIONS = [0, 180, 90, 270]


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _rotate_image(img: np.ndarray, degrees: int) -> np.ndarray:
    """Rotate by 0/90/180/270 degrees."""
    if degrees == 0:
        return img
    if degrees == 90:
        return cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    if degrees == 180:
        return cv2.rotate(img, cv2.ROTATE_180)
    if degrees == 270:
        return cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return img


def _preprocess(roi: np.ndarray) -> list[np.ndarray]:
    """
    Return several pre-processed versions of the ROI for better OCR hit rate.
    Upscale 2x only if the region is small enough to avoid huge images.
    """
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY) if roi.ndim == 3 else roi.copy()

    # Upscale 2x only for small regions; large regions are already high-res
    if max(gray.shape) <= _MAX_DIM_FOR_UPSCALE:
        gray = cv2.resize(gray, (gray.shape[1] * 2, gray.shape[0] * 2),
                          interpolation=cv2.INTER_CUBIC)

    # Sharpen
    kernel = np.array([[-1, -1, -1],
                       [-1,  9, -1],
                       [-1, -1, -1]])
    sharp = cv2.filter2D(gray, -1, kernel)

    # Otsu threshold
    _, otsu = cv2.threshold(sharp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Adaptive threshold
    adapt = cv2.adaptiveThreshold(sharp, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                  cv2.THRESH_BINARY, 31, 10)

    return [sharp, otsu, adapt]


def _parse_match(m: re.Match) -> dict:
    """Turn a regex match into a scale result dict."""
    num   = int(m.group("num"))
    den   = int(m.group("den")) if m.group("den") else 1
    feet  = int(m.group("feet"))
    inches = int(m.group("inches")) if m.group("inches") else 0

    paper_inches = num / den
    real_feet    = feet + inches / 12.0
    return {
        "raw"          : m.group(0).strip(),
        "paper_inches" : paper_inches,
        "real_feet"    : real_feet,
    }


def _ocr_region(img_bgr: np.ndarray, region: tuple) -> list[dict]:
    """
    Run OCR on one image region (all rotations) and return all scale matches.
    region = (y0_frac, y1_frac, x0_frac, x1_frac, label)
    """
    H, W = img_bgr.shape[:2]
    y0 = int(region[0] * H);  y1 = int(region[1] * H)
    x0 = int(region[2] * W);  x1 = int(region[3] * W)
    roi = img_bgr[y0:y1, x0:x1]
    if roi.size == 0:
        return []

    found = []
    for deg in _ROTATIONS:
        rotated = _rotate_image(roi, deg)
        for variant in _preprocess(rotated):
            for cfg in _TESS_CONFIGS:
                try:
                    text = pytesseract.image_to_string(variant, config=cfg)
                except Exception:
                    continue
                for m in _SCALE_RE.finditer(text):
                    result = _parse_match(m)
                    result["rotation"] = deg
                    if result not in found:
                        found.append(result)
        # Stop rotating once we find a match in this region
        if found:
            break
    return found


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #

def detect_scale(image_path: str, dpi: int = 300) -> dict | None:
    """
    Scan the image for a drawing scale annotation and return a result dict:

        {
            "raw"           : "1/8\\"=1'-0\\"",   # raw OCR text
            "paper_inches"  : 0.125,               # inches on paper
            "real_feet"     : 1.0,                 # real-world feet
            "pixels_per_foot"  : 37.5,
            "pixels_per_meter" : 123.03,
        }

    Returns None if no scale is found.
    """
    bgr = cv2.imread(image_path)
    if bgr is None:
        raise FileNotFoundError(f"Cannot open image: {image_path}")

    print(f"  Scanning {bgr.shape[1]}x{bgr.shape[0]} px image for scale annotation ...")

    for i, region in enumerate(_SEARCH_REGIONS):
        label = region[4]
        H, W = bgr.shape[:2]
        rh = int((region[1] - region[0]) * H)
        rw = int((region[3] - region[2]) * W)
        print(f"  [{i+1}/{len(_SEARCH_REGIONS)}] {label:25s}  ({rw}x{rh} px) ...", end=" ", flush=True)
        matches = _ocr_region(bgr, region)
        if matches:
            print(f"FOUND: {matches[0]['raw']}")
            # Prefer valid scale values (paper_inches in realistic range)
            valid = [r for r in matches if 0 < r["paper_inches"] <= 1.0]
            if not valid:
                valid = matches
            best = valid[0]
            pixels_per_foot  = dpi * best["paper_inches"] / best["real_feet"]
            pixels_per_meter = pixels_per_foot * 3.28084
            result = {
                **best,
                "pixels_per_foot" : round(pixels_per_foot,  4),
                "pixels_per_meter": round(pixels_per_meter, 4),
                "dpi"             : dpi,
                "found_in"        : label,
            }
            return result
        else:
            print("not found")

    return None


def detect_scale_from_dimension(image_path: str, dpi: int = 300, approx_px_per_foot: float = None) -> dict | None:
    """Fallback stub for dimension scale extraction. Returns None."""
    return None


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def main():
    parser = argparse.ArgumentParser(
        description="Extract drawing scale from a schematic PNG using OCR.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Examples:
              python detect_scale.py page_0.png
              python detect_scale.py page_0.png --dpi 150
        """),
    )
    parser.add_argument("image", help="Path to the PNG image")
    parser.add_argument("--dpi", type=int, default=300,
                        help="DPI the image was converted at (default: 300)")
    args = parser.parse_args()

    print(f"\n=== Scale Detector ===")
    print(f"Image : {args.image}")
    print(f"DPI   : {args.dpi}\n")

    title_result = detect_scale(args.image, dpi=args.dpi)
    dim_result   = None

    if title_result is None:
        print("  Title block: not found. Scanning drawing body for dimension annotation ...")
        dim_result = detect_scale_from_dimension(args.image, dpi=args.dpi)
    else:
        # Also run body scan to cross-check (image may be printed at wrong zoom)
        dim_result = detect_scale_from_dimension(
            args.image, dpi=args.dpi,
            approx_px_per_foot=title_result["pixels_per_foot"]
        )

    # Choose best result: body annotation > title block
    result = dim_result or title_result

    if result is None:
        print("ERROR: No scale annotation found by either method.")
        print("       Check that Tesseract is installed and the drawing is visible.")
        sys.exit(1)

    if dim_result:
        print(f"\n  Annotation     : {dim_result['raw']}")
        print(f"  Real length    : {dim_result['real_feet']:.4f} ft")
        print(f"  Pixel span     : {dim_result['pixel_length']} px")
        print(f"  Pixels/foot    : {dim_result['pixels_per_foot']}")
        print(f"  Pixels/meter   : {dim_result['pixels_per_meter']}")
        print(f"  Found in       : {dim_result['found_in']}")
        if title_result:
            ratio = dim_result['pixels_per_foot'] / title_result['pixels_per_foot']
            print(f"  Title block    : '{title_result['raw']}'  "
                  f"-> {title_result['pixels_per_foot']} px/ft  "
                  f"(deviation: {abs(ratio-1)*100:.1f}%)")
    else:
        print(f"\n  Raw OCR text   : {result['raw']}")
        print(f"  Paper inches   : {result['paper_inches']}\"  per  {result['real_feet']} ft real")
        print(f"  Pixels/foot    : {result['pixels_per_foot']}")
        print(f"  Pixels/meter   : {result['pixels_per_meter']}")
        print(f"  Found in       : {result['found_in']}")

    print(f"\n  => Use these values in wire_analyzer_v2.py:")
    print(f"       PIXELS_PER_FOOT  = {result['pixels_per_foot']}")
    print(f"       PIXELS_PER_METER = {result['pixels_per_meter']}")


if __name__ == "__main__":
    main()

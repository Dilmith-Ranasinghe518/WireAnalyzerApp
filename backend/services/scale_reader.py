#!/usr/bin/env python3
"""
scale_reader.py
---------------
Extracts the drawing scale annotation (e.g. "Scale: 1/8''=1'-0''")
from an architectural / wiring diagram PNG using OCR.

Handles:
  • Upside-down / rotated title blocks  (tries all 4 orientations)
  • OCR noise in quote characters       ('' treated same as ")
  • "Scale:" prefix or bare ratio       (1/4"=1'-0" without prefix)
  • Multiple preprocessing pipelines    (sharpened, Otsu, adaptive)

Usage
-----
    python scale_reader.py diagram.png
    python scale_reader.py diagram.png --dpi 300
    python scale_reader.py diagram.png --debug   # saves annotated ROI images

Output
------
    Scale text   : 1/8" = 1'-0"
    Paper inches : 0.125
    Real feet    : 1.0
    Pixels/foot  : 37.5   (at 300 DPI)
    Pixels/meter : 123.03 (at 300 DPI)

Requirements
------------
    pip install opencv-python pytesseract pillow numpy
    + Tesseract binary: https://github.com/UB-Mannheim/tesseract/wiki
"""

import sys
import re
import os
import argparse
from pathlib import Path

import cv2
import numpy as np

# ── Tesseract setup ────────────────────────────────────────────────────────
import pytesseract
_TESS_CANDIDATES = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    rf"C:\Users\{os.environ.get('USERNAME','')}\AppData\Local\Programs\Tesseract-OCR\tesseract.exe",
]
for _p in _TESS_CANDIDATES:
    if Path(_p).exists():
        pytesseract.pytesseract.tesseract_cmd = _p
        break

# ── Regex for ratio scale patterns ────────────────────────────────────────
#
# Target formats (OCR produces noisy variants of these):
#   Scale: 1/8" = 1'-0"
#   1/4" = 1'-0"
#   3/16" = 1'
#   1" = 1'-0"
#
# OCR noise handled:
#   ''  treated as "         (double apostrophe instead of double-quote)
#   ` ' ' treated as '       (various apostrophe glyphs)
#   space around = and -
#   optional "Scale" / "SCALE" prefix with colon or space
#   optional trailing -0" after real feet

_Q  = r"""[""''`'′″]"""           # any quote-like character
_QQ = rf"(?:{_Q}{{1,2}})"         # one or two quote characters ('' or ")
_AP = r"""[''`'′]"""              # apostrophe variants

_SCALE_RE = re.compile(
    rf"""
    (?:scale\s*[:\s]\s*)?          # optional   "Scale:" or "Scale " prefix
    (?P<num>\d+)                   # numerator  e.g. 1
    (?:\s*/\s*(?P<den>\d+))?       # optional   /8   denominator
    \s*{_QQ}?                      # optional   inch mark (may be missing)
    \s*[=:]\s*                     # separator  = or :
    \s*(?P<feet>\d+)               # real feet  almost always 1
    \s*{_AP}\s*                    # foot mark
    (?:                            # optional   -0" part
        [-–\s]*
        (?P<inches>\d+)
        \s*{_QQ}?
    )?
    """,
    re.VERBOSE | re.IGNORECASE,
)

# Also search for "Scale" keyword as an anchor to extract nearby text
_SCALE_KW_RE = re.compile(r"scale\s*[:\s]", re.IGNORECASE)


# ── Image regions to search ────────────────────────────────────────────────
# (y_start, y_end, x_start, x_end) as fractions of image size.
# Title blocks appear in one of the four corners; we also search edge strips.
_REGIONS = [
    (0.00, 0.18, 0.55, 1.00, "top-right"),
    (0.00, 0.18, 0.00, 0.45, "top-left"),
    (0.82, 1.00, 0.55, 1.00, "bottom-right"),
    (0.82, 1.00, 0.00, 0.45, "bottom-left"),
    (0.00, 0.10, 0.00, 1.00, "top-strip"),
    (0.90, 1.00, 0.00, 1.00, "bottom-strip"),
    (0.00, 1.00, 0.00, 1.00, "full-image"),   # last resort, slowest
]

_ROTATIONS  = [0, 180, 90, 270]
_PSM_MODES  = ["--psm 6", "--psm 11", "--psm 3"]


# ── Preprocessing pipelines ───────────────────────────────────────────────

def _preprocess_variants(gray: np.ndarray) -> list:
    """
    Return several preprocessed versions of a grayscale ROI.
    More variants = better OCR hit rate on low-contrast scans.
    """
    variants = []

    # 1. Upscale 2x if region is small (helps Tesseract on small text)
    h, w = gray.shape
    if max(h, w) < 800:
        gray = cv2.resize(gray, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)

    # 2. Sharpened (unsharp mask)
    blur   = cv2.GaussianBlur(gray, (0, 0), 3)
    sharp  = cv2.addWeighted(gray, 1.8, blur, -0.8, 0)
    variants.append(("sharp", sharp))

    # 3. Otsu threshold on sharpened
    _, otsu = cv2.threshold(sharp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants.append(("otsu", otsu))

    # 4. Adaptive threshold (better for uneven lighting in scans)
    adapt = cv2.adaptiveThreshold(
        sharp, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 10
    )
    variants.append(("adaptive", adapt))

    # 5. Inverted adaptive (dark background, light text)
    variants.append(("adaptive-inv", cv2.bitwise_not(adapt)))

    return variants


# ── OCR helpers ───────────────────────────────────────────────────────────

def _ocr_text(img: np.ndarray, psm: str) -> str:
    """Run Tesseract on a preprocessed image and return the raw text string."""
    try:
        from PIL import Image as PILImage
        pil = PILImage.fromarray(img)
        return pytesseract.image_to_string(pil, config=psm)
    except Exception:
        return ""


def _clean_ocr_text(text: str) -> str:
    """
    Normalise common OCR substitutions so the regex can match reliably.
      ''  → "    (double apostrophe → double-quote)
      l'  often read as 1'
    """
    # Normalise Unicode fancy quotes to ASCII
    text = (text
            .replace("‘", "'").replace("’", "'")
            .replace("“", '"').replace("”", '"')
            .replace("′", "'").replace("″", '"')
            )
    # Two consecutive apostrophes → double-quote
    text = re.sub(r"'{2}", '"', text)
    return text


# ── Core extraction ───────────────────────────────────────────────────────

def _parse_match(m: re.Match, raw_text: str, source: str, rotation: int) -> dict:
    """Build a result dict from a regex match."""
    num    = int(m.group("num"))
    den    = int(m.group("den")) if m.group("den") else 1
    feet   = int(m.group("feet"))
    inches = int(m.group("inches")) if m.group("inches") else 0

    paper_in  = num / den
    real_ft   = feet + inches / 12.0

    # Confidence score: prefer matches with explicit "Scale" keyword
    kw_bonus = 20 if _SCALE_KW_RE.search(raw_text[:raw_text.find(m.group(0)) + 40]) else 0
    # Prefer common architectural scales (1/8, 1/4, 3/16, 1/16...)
    scale_bonus = 10 if den in (4, 8, 16, 32) else 0

    return {
        "raw"         : m.group(0).strip(),
        "paper_inches": round(paper_in, 6),
        "real_feet"   : round(real_ft, 4),
        "score"       : kw_bonus + scale_bonus,
        "source"      : source,
        "rotation"    : rotation,
    }


def _search_region(bgr: np.ndarray, region: tuple, debug_dir: str = "") -> list:
    """
    Run OCR on one image region across all rotations and preprocessing variants.
    Returns a list of candidate result dicts.
    """
    H, W = bgr.shape[:2]
    y0 = int(region[0] * H);  y1 = int(region[1] * H)
    x0 = int(region[2] * W);  x1 = int(region[3] * W)
    label = region[4]

    roi_bgr = bgr[y0:y1, x0:x1]
    if roi_bgr.size == 0:
        return []

    gray_base = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2GRAY)
    found = []
    seen_raw = set()

    for rotation in _ROTATIONS:
        # Rotate
        if rotation == 0:
            gray = gray_base
        elif rotation == 90:
            gray = cv2.rotate(gray_base, cv2.ROTATE_90_CLOCKWISE)
        elif rotation == 180:
            gray = cv2.rotate(gray_base, cv2.ROTATE_180)
        else:
            gray = cv2.rotate(gray_base, cv2.ROTATE_90_COUNTERCLOCKWISE)

        for variant_name, img in _preprocess_variants(gray):
            for psm in _PSM_MODES:
                raw_text  = _ocr_text(img, psm)
                clean     = _clean_ocr_text(raw_text)

                for m in _SCALE_RE.finditer(clean):
                    key = (m.group("num"), m.group("den"), m.group("feet"))
                    if key in seen_raw:
                        continue
                    seen_raw.add(key)
                    result = _parse_match(m, clean, f"{label}@{rotation}°/{variant_name}", rotation)
                    found.append(result)

                # Save debug ROI images on first hit in this variant
                if debug_dir and found:
                    fname = f"{label}_rot{rotation}_{variant_name}.png"
                    cv2.imwrite(os.path.join(debug_dir, fname), img)

            # Stop trying more variants/PSMs once we have a match at this rotation
            if found:
                break

        # Stop trying more rotations once we have a match in this region
        if found:
            break

    return found


# ── Public API ────────────────────────────────────────────────────────────

def read_scale(image_path: str, dpi: int = 300, debug: bool = False) -> dict | None:
    """
    Scan *image_path* for a ratio scale annotation.

    Returns a dict on success:
        {
            "raw"              : "1/8\" = 1'-0\"",
            "paper_inches"     : 0.125,
            "real_feet"        : 1.0,
            "pixels_per_foot"  : 37.5,
            "pixels_per_meter" : 123.03,
            "source"           : "top-right@180°/otsu",
            "rotation"         : 180,
        }
    Returns None if nothing is found.
    """
    bgr = cv2.imread(image_path)
    if bgr is None:
        raise FileNotFoundError(f"Cannot open image: {image_path}")

    debug_dir = ""
    if debug:
        debug_dir = str(Path(image_path).with_suffix("")) + "_scale_debug"
        os.makedirs(debug_dir, exist_ok=True)
        print(f"[debug] ROI images will be saved to: {debug_dir}/")

    all_candidates = []

    for region in _REGIONS:
        label = region[4]
        H, W = bgr.shape[:2]
        rh = int((region[1] - region[0]) * H)
        rw = int((region[3] - region[2]) * W)
        print(f"  Searching {label:<22} ({rw:4d}×{rh:3d} px) ...", end=" ", flush=True)

        hits = _search_region(bgr, region, debug_dir)

        if hits:
            print(f"FOUND {len(hits)}: {[h['raw'] for h in hits]}")
            all_candidates.extend(hits)
            # Skip remaining regions (except full-image which is last)
            # once we have a high-confidence hit
            if any(h["score"] >= 20 for h in hits):
                break
        else:
            print("—")

    if not all_candidates:
        return None

    # Sort by score descending, then by region order (earlier = title block)
    all_candidates.sort(key=lambda c: c["score"], reverse=True)
    best = all_candidates[0]

    pixels_per_foot  = dpi * best["paper_inches"] / best["real_feet"]
    pixels_per_meter = pixels_per_foot * 3.28084

    return {
        **best,
        "pixels_per_foot"  : round(pixels_per_foot,  4),
        "pixels_per_meter" : round(pixels_per_meter, 4),
        "dpi"              : dpi,
        "all_candidates"   : all_candidates,
    }


# ── CLI ───────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description="Extract ratio scale annotation from an architectural diagram PNG.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument("image",          help="Path to the PNG image")
    ap.add_argument("--dpi",  type=int, default=300,
                    help="DPI the image was scanned/converted at (default: 300)")
    ap.add_argument("--debug", action="store_true",
                    help="Save preprocessed ROI crops to <image>_scale_debug/")
    args = ap.parse_args()

    if not Path(args.image).exists():
        sys.exit(f"[error] File not found: {args.image}")

    print(f"\n=== Scale Reader ===")
    print(f"Image : {args.image}")
    print(f"DPI   : {args.dpi}\n")

    result = read_scale(args.image, dpi=args.dpi, debug=args.debug)

    print()
    if result is None:
        print("No scale annotation found.")
        print("\nTips:")
        print("  • Use --debug to inspect the preprocessed ROI images")
        print("  • Verify Tesseract is installed and the title block is legible")
        sys.exit(1)

    print("─" * 55)
    print(f"  Scale text     : {result['raw']}")
    print(f"  Paper inches   : {result['paper_inches']}\"  per  {result['real_feet']} ft")
    print(f"  Pixels/foot    : {result['pixels_per_foot']}")
    print(f"  Pixels/meter   : {result['pixels_per_meter']}")
    print(f"  Found in       : {result['source']}")
    print(f"  DPI used       : {result['dpi']}")
    print("─" * 55)

    if len(result["all_candidates"]) > 1:
        print(f"\n  All candidates ({len(result['all_candidates'])}):")
        for c in result["all_candidates"]:
            print(f"    {c['raw']:<20}  score={c['score']}  from={c['source']}")


if __name__ == "__main__":
    main()

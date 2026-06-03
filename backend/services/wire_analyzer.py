"""
Wire Analyzer v2
----------------
Detects colored wires in a schematic PNG and measures their real-world lengths.

Color input:  Each wire color is defined as EITHER:
    Option A – hex center + RGB tolerance:
        "red": { "hex": "#e66551", "tolerance": 40 }

    Option B – explicit RGB min/max range:
        "red": { "rgb_min": (190, 70, 55), "rgb_max": (255, 125, 115) }

    tolerance can be a single int (applied to all 3 channels) or a tuple
    (r_tol, g_tol, b_tol) for per-channel control.

Scale:        Auto-detected from the image title block via OCR (detect_scale.py).
              Falls back to 1/8"=1'-0" (37.5 px/ft) if OCR finds nothing.

Run ID:       A short random hex ID is generated each run.
              All output files for that run are prefixed with it, e.g.:
                  a3f2b1c9_mask_red.png
                  a3f2b1c9_annotated.png

Usage:
    python wire_analyzer_v2.py [image_path]        # defaults to page_0.png
"""

import os
import sys
import uuid
import cv2
import numpy as np
from skimage.morphology import skeletonize
from detect_scale import detect_scale

# Ensure UTF-8 on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# --------------------------------------------------------------------------- #
# Scale configuration  (resolved at runtime in main() via OCR)
# --------------------------------------------------------------------------- #

DPI = 300   # PDF was converted at 300 DPI

# Fallback values used when OCR cannot find a scale annotation
_FALLBACK_PAPER_INCHES = 0.125   # 1/8" on paper = 1 ft
_FALLBACK_REAL_FEET    = 1.0

# These are set by main() after OCR; initialised to fallback so other
# functions can be called independently if needed.
PIXELS_PER_FOOT  = DPI * _FALLBACK_PAPER_INCHES / _FALLBACK_REAL_FEET   # 37.5
PIXELS_PER_METER = PIXELS_PER_FOOT * 3.28084                             # ~123.03

# --------------------------------------------------------------------------- #
# Wire color definitions
# --------------------------------------------------------------------------- #
# Each entry must have EITHER:
#   "hex" (str) + optional "tolerance" (int or 3-tuple, default 35)
#   OR "rgb_min" (R,G,B) + "rgb_max" (R,G,B)
#
# "display_bgr": color used to draw annotations on the output image (BGR order).

WIRE_COLORS = {
    # Combines #e66551 (red) + #bf5657 (dark_red) + #f06c51 — union of all ±40 RGB ranges
    "red": {
    # Better detection for red + orange-red wires
    # Handles anti-aliased edges and darker scanned wires

    "rgb_min": (120, 25, 15),
    "rgb_max": (255, 170, 140),

    "display_bgr": (50, 60, 230),
},
#     "violet": {
#         "hex": "#7141b7",
#         "tolerance": 40,
#         "display_bgr": (183, 65, 113),
#     },

"violet": {
    "rgb_min": (55, 25, 120),
    "rgb_max": (170, 140, 255),
    "display_bgr": (183, 65, 113),
},




#  "rose": {

#     # tuned specifically for light pink electrical wiring

#     "rgb_min": (200, 110, 160),
#     "rgb_max": (255, 185, 235),

#     "display_bgr": (172, 75, 233),
# },

"rose": {

    # Supports:
    # - pale pink wires
    # - magenta wires
    # - darker rose wires
    # without affecting other diagrams

    "rgb_min": (170, 70, 140),
    "rgb_max": (255, 200, 255),

    "display_bgr": (172, 75, 233),
},
   
#  "green": {

#     # Green wire extraction ONLY
#     # Removes most green texts and annotations

#     "rgb_min": (0, 120, 40),
#     "rgb_max": (120, 255, 170),

#     "display_bgr": (30, 180, 30),
# },

"green": {
    "rgb_min": (0, 120, 20),
    "rgb_max": (170, 255, 170),
    "display_bgr": (30,180,30),
},


    # # #3c62b7 ±40
    # "blue": {
    #     "rgb_min": (20, 58, 143),
    #     "rgb_max": (100, 138, 223),
    #     "display_bgr": (200, 80, 30),
    # },

"blue": {

    # Improved blue wire extraction
    # Supports:
    # - pale blueprint blue
    # - darker CAD blue
    # - anti-aliased edges
    # without affecting other diagrams

    "rgb_min": (40, 70, 140),
    "rgb_max": (170, 220, 255),

    "display_bgr": (255, 120, 40),
},

    "light_blue": {
        "hex": "#008cc6",
        "tolerance": 40,
        "display_bgr": (200, 140, 0),
    },
    "yellow": {
        "hex": "#fed430",
        "tolerance": 40,
        "display_bgr": (0, 180, 220),
    },
}

# --------------------------------------------------------------------------- #
# Contour / wire filtering thresholds
# --------------------------------------------------------------------------- #

MIN_CONTOUR_AREA      = 20     # px² – discard tiny noise specks
MIN_ASPECT_RATIO      = 2.5    # long side / short side; straight wires are elongated
MAX_SOLIDITY          = 0.35   # area / convex-hull area; L-shaped/loop wires are hollow
MIN_WIRE_PIXEL_LENGTH = 30     # skeleton px – discard very short stubs

# --------------------------------------------------------------------------- #
# Morphological kernels
# --------------------------------------------------------------------------- #

_NOISE_KERNEL = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
_CLOSE_KERNEL = cv2.getStructuringElement(cv2.MORPH_RECT,    (5, 5))

# --------------------------------------------------------------------------- #
# Helper: hex → (R, G, B) tuple
# --------------------------------------------------------------------------- #

def _hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    h = hex_str.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


# --------------------------------------------------------------------------- #
# Helper: resolve a color entry to (rgb_min, rgb_max) tuples
# --------------------------------------------------------------------------- #

def _resolve_rgb_range(cfg: dict) -> tuple[tuple, tuple]:
    """
    Accepts either:
        {"hex": "#rrggbb", "tolerance": int_or_tuple}
        {"rgb_min": (R,G,B), "rgb_max": (R,G,B)}
    Returns (rgb_min, rgb_max) as plain Python 3-tuples.
    """
    if "rgb_min" in cfg and "rgb_max" in cfg:
        return tuple(cfg["rgb_min"]), tuple(cfg["rgb_max"])

    r, g, b = _hex_to_rgb(cfg["hex"])
    tol = cfg.get("tolerance", 35)
    if isinstance(tol, int):
        tr, tg, tb = tol, tol, tol
    else:
        tr, tg, tb = tol

    rgb_min = (max(0, r - tr), max(0, g - tg), max(0, b - tb))
    rgb_max = (min(255, r + tr), min(255, g + tg), min(255, b + tb))
    return rgb_min, rgb_max


# --------------------------------------------------------------------------- #
# Step 1: Build a binary mask for one wire color using RGB range matching
# --------------------------------------------------------------------------- #

def extract_color_mask(bgr: np.ndarray, color_name: str) -> np.ndarray:
    """
    Returns a binary mask (uint8, 255=wire pixel) for the named color.
    """

    cfg = WIRE_COLORS[color_name]
    rgb_min, rgb_max = _resolve_rgb_range(cfg)

    r_min, g_min, b_min = rgb_min
    r_max, g_max, b_max = rgb_max

    # OpenCV uses BGR
    lower = np.array([b_min, g_min, r_min], dtype=np.uint8)
    upper = np.array([b_max, g_max, r_max], dtype=np.uint8)

    mask = cv2.inRange(bgr, lower, upper)

    # Extra support for violet/purple wires
    if color_name == "violet":

       hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

       hsv_lower = np.array([120, 35, 70], dtype=np.uint8)
       hsv_upper = np.array([155, 255, 255], dtype=np.uint8)

       hsv_mask = cv2.inRange(hsv, hsv_lower, hsv_upper)

      # Keep only pixels satisfying BOTH RGB and HSV
       mask = cv2.bitwise_and(mask, hsv_mask)

    # Extra support for pale/dark blue wires
    if color_name == "blue":

       hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

       hsv_lower = np.array([90, 40, 120], dtype=np.uint8)
       hsv_upper = np.array([125, 255, 255], dtype=np.uint8)

       hsv_mask = cv2.inRange(hsv, hsv_lower, hsv_upper)

        # Keep only pixels satisfying BOTH RGB and HSV
       mask = cv2.bitwise_and(mask, hsv_mask)

# Extra support for green wires
    if color_name == "green":

       hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

       hsv_lower = np.array([35, 35, 60], dtype=np.uint8)
       hsv_upper = np.array([78, 255, 255], dtype=np.uint8)

       hsv_mask = cv2.inRange(hsv, hsv_lower, hsv_upper)

       # Keep only pixels satisfying BOTH RGB and HSV
       mask = cv2.bitwise_or(mask, hsv_mask)



    # Extra support for pale rose wires
    if color_name == "rose":

        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

        hsv_lower = np.array([145, 60, 160], dtype=np.uint8)
        hsv_upper = np.array([170, 255, 255], dtype=np.uint8)

        hsv_mask = cv2.inRange(hsv, hsv_lower, hsv_upper)

        # Merge HSV + RGB masks
        mask = cv2.bitwise_and(mask, hsv_mask)

    # Remove isolated noise pixels
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        _NOISE_KERNEL,
        iterations=1
    )

    # Fill tiny gaps
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        _CLOSE_KERNEL,
        iterations=1
    )

    # Connect broken rose wire segments
    # Connect broken rose wire segments
    if color_name == "rose":

        connect_kernel = cv2.getStructuringElement(
            cv2.MORPH_RECT,
            (9, 9)
        )

        mask = cv2.morphologyEx(
            mask,
            cv2.MORPH_CLOSE,
            connect_kernel,
            iterations=2
        )

    return mask


def filter_wire_contours(mask: np.ndarray, color_name: str) -> tuple[np.ndarray, list]:
    """
    Returns (wire_mask, wire_contours).
    """

    contours, _ = cv2.findContours(
        mask,
        cv2.RETR_LIST,
        cv2.CHAIN_APPROX_SIMPLE
    )

    wire_mask = np.zeros_like(mask)
    wire_contours = []

    for cnt in contours:

        area = cv2.contourArea(cnt)

        if area < MIN_CONTOUR_AREA:
            continue

        x, y, w, h = cv2.boundingRect(cnt)

        long_side = max(w, h)
        short_side = min(w, h) + 1e-9

        aspect = long_side / short_side

        hull = cv2.convexHull(cnt)
        hull_area = cv2.contourArea(hull) + 1e-9

        solidity = area / hull_area

        # -----------------------------------------
# SPECIAL FILTERING FOR GREEN WIRES
# -----------------------------------------
        if color_name == "green":

    # Remove tiny green text
           if area < 100:
              continue

    # Remove long scan lines
           if min(w, h) <= 3 and max(w, h) > 400:
              continue

        # -----------------------------------------
        # SPECIAL FILTERING FOR ROSE WIRES
        # -----------------------------------------
        if color_name == "rose":

            # Remove tiny rose text
            if area < 120:
                continue

            if w < 12 and h < 12:
                continue


        else:

            # Original filtering
            if aspect < MIN_ASPECT_RATIO and solidity >= MAX_SOLIDITY:
                continue

        # Keep contour
        cv2.drawContours(
            wire_mask,
            [cnt],
            -1,
            255,
            thickness=cv2.FILLED
        )

        wire_contours.append(cnt)

    return wire_mask, wire_contours

# --------------------------------------------------------------------------- #
# Step 3: Measure skeleton length of each accepted wire contour
# --------------------------------------------------------------------------- #

def _skeleton_pixel_length(binary_mask: np.ndarray) -> float:
    """Thin the filled mask to a 1-px centerline and count its pixels."""
    skel = skeletonize(binary_mask > 0)
    return float(np.count_nonzero(skel))


def measure_wires(wire_mask: np.ndarray, wire_contours: list) -> list[dict]:
    """
    Returns a list of dicts, one per accepted wire segment:
        id, bbox, pixel_length, length_ft, length_m
    """
    results = []
    for i, cnt in enumerate(wire_contours):
        x, y, w, h = cv2.boundingRect(cnt)
        roi_mask   = wire_mask[y:y + h, x:x + w]
        pix_len    = _skeleton_pixel_length(roi_mask)

        if pix_len < MIN_WIRE_PIXEL_LENGTH:
            continue

        results.append({
            "id"          : i + 1,
            "bbox"        : (x, y, w, h),
            "pixel_length": pix_len,
            "length_ft"   : pix_len / PIXELS_PER_FOOT,
            "length_m"    : pix_len / PIXELS_PER_METER,
        })

    return results


# --------------------------------------------------------------------------- #
# Step 4: Annotate the original image with overlays and labels
# --------------------------------------------------------------------------- #

def draw_results(bgr: np.ndarray, color_results: dict) -> np.ndarray:
    """
    color_results: { color_name: { "wire_mask": ndarray, "results": list } }
    Draws semi-transparent overlays + bounding boxes + length labels.
    """
    out = bgr.copy()

    for color_name, data in color_results.items():
        display_bgr = WIRE_COLORS[color_name]["display_bgr"]
        wire_mask   = data["wire_mask"]
        results     = data["results"]

        # Semi-transparent color overlay over wire pixels
        overlay = np.zeros_like(out)
        overlay[wire_mask > 0] = display_bgr
        out = cv2.addWeighted(out, 1.0, overlay, 0.45, 0)

        for r in results:
            x, y, w, h = r["bbox"]
            prefix = color_name[0].upper()
            label  = f"{prefix}{r['id']}: {r['length_ft']:.2f}ft ({r['length_m']:.2f}m)"
            cv2.rectangle(out, (x, y), (x + w, y + h), display_bgr, 1)
            cv2.putText(out, label, (x, max(y - 4, 14)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.40, display_bgr, 1, cv2.LINE_AA)

    return out


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

def main(image_path: str = "page_new.png"):
    global PIXELS_PER_FOOT, PIXELS_PER_METER

    run_id  = uuid.uuid4().hex[:8]   # unique prefix for all files of this run
    out_dir = os.path.join("runs", run_id)
    os.makedirs(out_dir, exist_ok=True)
    print(f"\n=== Wire Analyzer v2 ===")
    print(f"Run ID    : {run_id}")
    print(f"Output dir: {out_dir}")
    print(f"Image     : {image_path}")

    # --- Auto-detect scale from title block ---
    print(f"\nDetecting scale ...")
    scale = detect_scale(image_path, dpi=DPI)
    if scale:
        PIXELS_PER_FOOT  = scale["pixels_per_foot"]
        PIXELS_PER_METER = scale["pixels_per_meter"]
        print(f"  Scale found    : {scale['raw']}  "
              f"({scale['paper_inches']}\" = {scale['real_feet']} ft)")
    else:
        print(f"  WARNING: Scale not found by OCR. "
              f"Using fallback {_FALLBACK_PAPER_INCHES}\"=1'-0\"")
    print(f"  Pixels/foot    : {PIXELS_PER_FOOT}")
    print(f"  Pixels/meter   : {PIXELS_PER_METER}\n")

    bgr = cv2.imread(image_path)
    if bgr is None:
        print(f"ERROR: Cannot open '{image_path}'")
        sys.exit(1)

    print(f"Image size: {bgr.shape[1]} x {bgr.shape[0]} px\n")

    color_results = {}
    grand_px  = 0.0
    grand_ft  = 0.0
    grand_m   = 0.0

    for color_name, cfg in WIRE_COLORS.items():
        rgb_min, rgb_max = _resolve_rgb_range(cfg)
        print(f"[{color_name.upper()}]  RGB range: {rgb_min} → {rgb_max}")

        # 1. Color mask
        color_mask = extract_color_mask(bgr, color_name)
        n_px = int(np.count_nonzero(color_mask))
        print(f"  Matched pixels : {n_px}")

        # 2. Filter wires
        # wire_mask, wire_contours = filter_wire_contours(color_mask)
        wire_mask, wire_contours = filter_wire_contours(color_mask, color_name)
        print(f"  Wire contours  : {len(wire_contours)}")

        # 3. Measure
        results = measure_wires(wire_mask, wire_contours)
        color_results[color_name] = {"wire_mask": wire_mask, "results": results}

        # 4. Save per-color mask
        mask_path = os.path.join(out_dir, f"{run_id}_mask_{color_name}.png")
        cv2.imwrite(mask_path, wire_mask)
        print(f"  Mask saved     : {mask_path}")

        # 5. Print per-color table
        if results:
            print(f"\n  {'ID':<6} {'Pixels':>8}  {'Feet':>10}  {'Meters':>10}  BBox")
            print(f"  {'-'*60}")
            sub_px = sub_ft = sub_m = 0.0
            for r in results:
                wid = f"{color_name[0].upper()}{r['id']}"
                print(f"  {wid:<6} {r['pixel_length']:>8.1f}  "
                      f"{r['length_ft']:>10.3f}  {r['length_m']:>10.3f}  {r['bbox']}")
                sub_px += r["pixel_length"]
                sub_ft += r["length_ft"]
                sub_m  += r["length_m"]
            print(f"  {'sub':<6} {sub_px:>8.1f}  {sub_ft:>10.3f}  {sub_m:>10.3f}")
            grand_px += sub_px
            grand_ft += sub_ft
            grand_m  += sub_m
        print()

    # Grand total
    print("=" * 60)
    print(f"GRAND TOTAL")
    print(f"  Pixel length : {grand_px:.1f} px")
    print(f"  Real length  : {grand_ft:.3f} ft  |  {grand_m:.3f} m")
    print("=" * 60)

    # Annotated output
    annotated      = draw_results(bgr, color_results)
    annotated_path = os.path.join(out_dir, f"{run_id}_annotated.png")
    cv2.imwrite(annotated_path, annotated)
    print(f"\nAnnotated image : {annotated_path}")
    print(f"Mask files      : {out_dir}\\{run_id}_mask_<color>.png  (one per color)")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "page_0.png"
    main(path)

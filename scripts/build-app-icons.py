# Draws the 킵온 (KeepOn) app icon set from simple vector shapes (original artwork, no external assets).
# Usage: python scripts/build-app-icons.py   (needs Pillow: python -m pip install Pillow)
# Output: assets/images/{icon,android-icon-foreground,android-icon-monochrome,splash-icon,favicon}.png
#
# Motif: a white inbox tray with a single "tap" dot dropping into it — "save it, act on it".
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'images'
ACCENT = (41, 108, 90)  # icon gradient top (#296C5A)
ACCENT_DEEP = (7, 78, 63)  # icon gradient bottom (#074E3F)
GLYPH = (218, 250, 237, 255)  # mint glyph (#DAFAED)
SS = 4  # supersampling factor for smooth edges


def glyph_mask(size: int, scale: float = 1.0) -> Image.Image:
    """Tray + dot as an L mask centred in a `size` canvas. `scale` shrinks it for adaptive-icon safe zones."""
    s = size * scale
    off = (size - s) / 2
    w = int(s * 0.07)  # stroke width

    def p(x: float, y: float) -> tuple[float, float]:
        return (off + x * s, off + y * s)

    mask = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(mask)
    # Tray: rounded box outline with its top edge removed (open inbox).
    left, right, top, bottom = 0.22, 0.78, 0.46, 0.78
    d.rounded_rectangle([p(left, top), p(right, bottom)], radius=int(s * 0.09), outline=255, width=w)
    d.rectangle([p(left + 0.04, top - 0.05), p(right - 0.04, top + 0.035)], fill=0)
    # Inner shelf with a soft notch, drawn as one joined stroke.
    shelf_y = top + 0.12
    d.line([p(left, shelf_y), p(0.38, shelf_y), p(0.43, shelf_y + 0.07), p(0.57, shelf_y + 0.07), p(0.62, shelf_y), p(right, shelf_y)], fill=255, width=w, joint='curve')
    # The "tap" dot dropping into the tray.
    r = 0.075
    cx, cy = 0.5, 0.30
    d.ellipse([p(cx - r, cy - r), p(cx + r, cy + r)], fill=255)
    return mask


def gradient(big: int) -> Image.Image:
    g = Image.new('RGBA', (big, big))
    d = ImageDraw.Draw(g)
    for y in range(big):
        t = y / big
        d.line([(0, y), (big, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(ACCENT, ACCENT_DEEP)) + (255,))
    return g


def render(size: int, background, glyph_color, scale: float, rounded: bool = False) -> Image.Image:
    big = size * SS
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    if background is not None:
        # Deep-green vertical gradient, full-bleed or as a rounded square.
        mask = Image.new('L', (big, big), 255 if not rounded else 0)
        if rounded:
            ImageDraw.Draw(mask).rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * 0.24), fill=255)
        img.paste(gradient(big), (0, 0), mask)
    img.paste(Image.new('RGBA', (big, big), glyph_color), (0, 0), glyph_mask(big, scale))
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    white = (255, 255, 255, 255)
    render(1024, ACCENT, GLYPH, 1.0).save(OUT / 'icon.png')
    # Adaptive icon: background color comes from app.json; keep the glyph inside the 66% safe zone.
    render(1024, None, GLYPH, 0.62).save(OUT / 'android-icon-foreground.png')
    render(1024, None, white, 0.62).save(OUT / 'android-icon-monochrome.png')
    render(512, ACCENT, GLYPH, 1.0, rounded=True).save(OUT / 'splash-icon.png')
    render(48, ACCENT, GLYPH, 1.0, rounded=True).save(OUT / 'favicon.png')
    print(f'icons written to {OUT}')


def build_store_assets() -> None:
    """Google Play 512x512 icon (no alpha). The feature graphic is rendered by scripts/store-feature-graphic.mjs."""
    store = ROOT / 'docs' / 'store' / 'assets'
    store.mkdir(parents=True, exist_ok=True)
    render(512, ACCENT, GLYPH, 1.0).convert('RGB').save(store / 'play-icon-512.png')
    print(f'store icon written to {store}')


if __name__ == '__main__':
    import sys

    build_store_assets() if '--store' in sys.argv else main()

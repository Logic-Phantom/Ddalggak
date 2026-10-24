# Draws the 딸깍 app icon set from simple vector shapes (original artwork, no external assets).
# Usage: python scripts/build-app-icons.py   (needs Pillow: python -m pip install Pillow)
# Output: assets/images/{icon,android-icon-foreground,android-icon-monochrome,splash-icon,favicon}.png
#
# Motif: a white inbox tray with a single "tap" dot dropping into it — "save it, act on it".
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'images'
ACCENT = (47, 91, 211)  # tokens.ts lightColors.accent
ACCENT_DEEP = (34, 68, 170)
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
    # The "딸깍" dot dropping into the tray.
    r = 0.075
    cx, cy = 0.5, 0.30
    d.ellipse([p(cx - r, cy - r), p(cx + r, cy + r)], fill=255)
    return mask


def render(size: int, background, glyph_color, scale: float, rounded: bool = False) -> Image.Image:
    big = size * SS
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if background is not None:
        if rounded:
            d.rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * 0.22), fill=background)
        else:
            # Subtle vertical gradient on the full-bleed square.
            for y in range(big):
                t = y / big
                c = tuple(round(a + (b - a) * t) for a, b in zip(ACCENT, ACCENT_DEEP))
                d.line([(0, y), (big, y)], fill=c + (255,))
    img.paste(Image.new('RGBA', (big, big), glyph_color), (0, 0), glyph_mask(big, scale))
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    white = (255, 255, 255, 255)
    render(1024, ACCENT, white, 1.0).save(OUT / 'icon.png')
    # Adaptive icon: background color comes from app.json; keep the glyph inside the 66% safe zone.
    render(1024, None, white, 0.62).save(OUT / 'android-icon-foreground.png')
    render(1024, None, white, 0.62).save(OUT / 'android-icon-monochrome.png')
    render(512, ACCENT, white, 1.0, rounded=True).save(OUT / 'splash-icon.png')
    render(48, ACCENT, white, 1.0, rounded=True).save(OUT / 'favicon.png')
    print(f'icons written to {OUT}')


if __name__ == '__main__':
    main()

"""
Render a song-profile portrait PNG.

Translates the 8 deterministic knobs into an evocative still image — the
visual world that profile would produce, frozen as a single frame. Same
profile in → same image out (deterministic random seed from song title).

Usage: render_profile_image.py <profile.json> <out.png>
"""

import colorsys
import json
import math
import random
import sys

from PIL import Image, ImageDraw, ImageFilter


def hsl(h, s, l, alpha=1.0):
    r, g, b = colorsys.hls_to_rgb((h % 360) / 360, max(0, min(1, l / 100)), max(0, min(1, s / 100)))
    return (int(r * 255), int(g * 255), int(b * 255), int(max(0, min(1, alpha)) * 255))


def render(profile_path, out_path, size=1600):
    with open(profile_path) as f:
        profile = json.load(f)

    knobs = profile["knobs"]
    primary = knobs["base_palette"]["primary"]
    accent = knobs["base_palette"]["accent"]
    panic = knobs["panic_palette"]
    scar = knobs["missed_word_scar"]
    bridge = knobs.get("bridge_palette")
    drift = knobs["palette_drift_range"]
    smear_decay = knobs["motion_smear_decay"]
    drift_factor = drift / 35.0
    snap = 1.0 - smear_decay  # higher = snappier
    feat = profile["song_features"]
    energy = feat["energy"]
    valence = feat["valence"]

    # Deterministic seed from title — same song always renders identically.
    seed = sum(ord(c) for c in (profile.get("song_title") or "")) or 42
    random.seed(seed)

    # ---- Base: vertical gradient from primary (top) toward a slightly drifted version (bottom). ----
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    base = Image.new("RGBA", (1, size), (0, 0, 0, 0))
    bd = ImageDraw.Draw(base, "RGBA")
    for y in range(size):
        t = y / size
        # Gradient drifts hue by half the drift_range; lightness dips slightly toward the bottom.
        h = primary["hue"] + (t - 0.5) * drift
        s = primary["sat"] + (0.5 - abs(t - 0.5)) * 6
        l = primary["light"] - (t - 0.5) * 8
        bd.point((0, y), fill=hsl(h, s, l, 1.0))
    base = base.resize((size, size))
    img = Image.alpha_composite(img, base)

    # ---- Layer 1: long painterly smears in accent. The signature horizontal motion of the engine. ----
    # Higher smear_decay (dreamy) => longer, fewer, blurrier streaks.
    # Lower smear_decay (snappy)  => shorter, more numerous, sharper streaks.
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    n_smears = int(14 + snap * 60)
    for _ in range(n_smears):
        x = random.randint(-int(size * 0.4), size)
        y = random.randint(int(size * 0.05), int(size * 0.95))
        w = random.randint(int(size * (0.30 + smear_decay * 0.55)), int(size * (0.55 + smear_decay * 0.55)))
        h_h = random.randint(int(8 + snap * 16), int(20 + snap * 70))
        hue = accent["hue"] + (random.random() - 0.5) * 28 * drift_factor
        s = max(40, min(98, accent["sat"] + (random.random() - 0.5) * 12))
        l = max(28, min(85, accent["light"] + (random.random() - 0.5) * 14))
        alpha = random.uniform(0.18, 0.42)
        d.rectangle([x, y, x + w, y + h_h], fill=hsl(hue, s, l, alpha))
    img = Image.alpha_composite(img, layer.filter(ImageFilter.GaussianBlur(radius=int(10 + smear_decay * 38))))

    # ---- Layer 2: bridge wash (if present) — a soft cool atmosphere covering ~one quadrant. ----
    if bridge:
        layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer, "RGBA")
        # Concentrated upper-left region, then heavily blurred so it reads as ambient haze.
        cx0, cy0 = int(size * 0.0), int(size * 0.0)
        cx1, cy1 = int(size * 0.65), int(size * 0.65)
        for _ in range(36):
            cx = random.randint(cx0, cx1)
            cy = random.randint(cy0, cy1)
            r = random.randint(int(size * 0.10), int(size * 0.32))
            alpha = random.uniform(0.18, 0.42)
            d.ellipse([cx - r, cy - r, cx + r, cy + r],
                      fill=hsl(bridge["hue"], bridge["sat"], bridge["light"], alpha))
        img = Image.alpha_composite(img, layer.filter(ImageFilter.GaussianBlur(radius=int(size * 0.06))))

    # ---- Layer 3: accent blooms — fewer, bigger, softer than v1. The "voice peak" moments. ----
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    n_blooms = int(4 + energy * 14)
    for _ in range(n_blooms):
        cx = random.randint(int(size * 0.05), int(size * 0.95))
        cy = random.randint(int(size * 0.05), int(size * 0.95))
        r = random.randint(int(size * 0.10), int(size * 0.28))
        h = accent["hue"] + (random.random() - 0.5) * 18
        s = max(60, min(98, accent["sat"]))
        l = max(35, min(85, accent["light"] + (random.random() - 0.5) * 8))
        alpha = random.uniform(0.22, 0.45)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=hsl(h, s, l, alpha))
    img = Image.alpha_composite(img, layer.filter(ImageFilter.GaussianBlur(radius=22)))

    # ---- Layer 4: panic specks — small intense flashes, sparse. ----
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    n_panic = int(3 + energy * 5)
    for _ in range(n_panic):
        cx = random.randint(0, size)
        cy = random.randint(0, size)
        r = random.randint(int(size * 0.018), int(size * 0.06))
        alpha = random.uniform(0.30, 0.60)
        d.ellipse([cx - r, cy - r, cx + r, cy + r],
                  fill=hsl(panic["hue"], panic["sat"], panic["light"], alpha))
    img = Image.alpha_composite(img, layer.filter(ImageFilter.GaussianBlur(radius=3)))

    # ---- Layer 5: scars — sparse, short, dark, body-tonal-family marks. ----
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    for _ in range(random.randint(3, 7)):
        x = random.randint(0, size)
        y = random.randint(0, size)
        w = random.randint(int(size * 0.04), int(size * 0.16))
        h_h = random.randint(2, 8)
        d.rectangle([x, y, x + w, y + h_h],
                    fill=hsl(scar["hue"], scar["sat"], scar["light"], 0.55))
    img = Image.alpha_composite(img, layer.filter(ImageFilter.GaussianBlur(radius=1)))

    # ---- Vignette: subtle dark falloff at the edges. ----
    vignette = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vignette, "RGBA")
    cx, cy = size // 2, size // 2
    max_r = int(size * 0.72)
    for radius in range(max_r, size, 4):
        alpha = int(min(80, (radius - max_r) * 0.6))
        vd.ellipse([cx - radius, cy - radius, cx + radius, cy + radius],
                   outline=(0, 0, 0, alpha), width=4)
    img = Image.alpha_composite(img, vignette.filter(ImageFilter.GaussianBlur(radius=20)))

    # ---- Grain: very subtle photographic noise. ----
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    for _ in range(int(size * size / 350)):
        x = random.randint(0, size - 1)
        y = random.randint(0, size - 1)
        bright = random.choice([(255, 255, 255, 10), (0, 0, 0, 14)])
        d.point((x, y), fill=bright)
    img = Image.alpha_composite(img, layer)

    img.convert("RGB").save(out_path, "PNG")
    print(f"Saved {out_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: render_profile_image.py <profile.json> <out.png>", file=sys.stderr)
        sys.exit(1)
    render(sys.argv[1], sys.argv[2])

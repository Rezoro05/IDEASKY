"""Compare current screenshots to the baseline. Prints size and % of differing pixels per page; writes diff images."""
import sys, os
from PIL import Image, ImageChops
base, cur = "tests/parity/baseline", "tests/parity/current"
os.makedirs("tests/parity/diff", exist_ok=True)
worst = 0
for f in sorted(os.listdir(base)):
    a = Image.open(f"{base}/{f}").convert("RGB")
    if not os.path.exists(f"{cur}/{f}"): print(f"{f:24} MISSING"); worst = 100; continue
    b = Image.open(f"{cur}/{f}").convert("RGB")
    h = min(a.height, b.height)
    d = ImageChops.difference(a.crop((0, 0, a.width, h)), b.crop((0, 0, b.width, h))).convert("L").point(lambda p: 255 if p > 24 else 0)
    pct = 100 * sum(d.histogram()[255:]) / (a.width * h)
    worst = max(worst, pct, 100 if a.size != b.size else 0)
    if pct: d.save(f"tests/parity/diff/{f}")
    print(f"{f:24} base {a.size}  now {b.size}  differing {pct:.2f}%")
sys.exit(0 if worst < 0.5 else 1)

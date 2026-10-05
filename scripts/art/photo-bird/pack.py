"""Pack the six cut-outs into the bird sprites: flip left-facing poses to face right, share one box across the flight frames, crop, scale, anchor, save WebP + a TS table."""
import cv2, numpy as np, json
from PIL import Image
SCALE = 0.4
FRAMES = [  # id, source index, flip?, kind
  ("rest-side", 1, False, "rest"), ("rest-back", 2, True, "rest"), ("rest-preen", 5, True, "rest"),
  ("fly-glide", 3, False, "fly"), ("fly-up", 4, False, "fly"), ("fly-spread", 6, False, "fly"),
]
def load(i, flip):
    r = cv2.imread("raw%d.png" % i, cv2.IMREAD_UNCHANGED)
    return r[:, ::-1].copy() if flip else r
def bbox(a, pad=6):
    ys, xs = np.nonzero(a > 12); return max(xs.min()-pad, 0), max(ys.min()-pad, 0), xs.max()+pad, ys.max()+pad
frames = {fid: load(i, flip) for fid, i, flip, _ in FRAMES}
# flight frames share one box (head and body sit in the same place in all three photos)
fb = [bbox(frames[f][..., 3]) for f, _, _, k in FRAMES if k == "fly"]
fly_box = (min(b[0] for b in fb), min(b[1] for b in fb), max(b[2] for b in fb), max(b[3] for b in fb))
# the body anchor: where the folded-wing frame's mass centres (the same point for all three)
g = frames["fly-glide"][..., 3].astype(np.float32); ys, xs = np.mgrid[0:g.shape[0], 0:g.shape[1]]
cx, cy = (xs * g).sum() / g.sum(), (ys * g).sum() / g.sum()
table = {}
for fid, i, flip, kind in FRAMES:
    img = frames[fid]; a = img[..., 3]
    if kind == "fly": x0, y0, x1, y1 = fly_box; ax_px, ay_px = cx - x0, cy - y0
    elif fid in ("rest-side", "rest-back"):   # no legs in these photos: the belly's flat lower edge is the perch line; the tail hangs below it
        x0, y0, x1, y1 = bbox(a)
        wid = (a > 40).sum(axis=1); belly = int(np.nonzero(wid >= 0.5 * wid.max())[0].max())
        below = (a[belly + 4:] > 40).any(axis=0) if belly + 4 < a.shape[0] else np.zeros(a.shape[1], bool)
        ramp = 16
        for k in range(ramp):   # feather the flat cut (belly columns only, so the tail keeps its tip)
            y = belly - ramp + 1 + k
            img[y, ~below, 3] = (img[y, ~below, 3] * (0.25 + 0.75 * (1 - k / (ramp - 1)))).astype(np.uint8)
        img[belly + 1:belly + 4, ~below, 3] = 0
        cols = np.nonzero((a[belly - 6:belly] > 40).any(axis=0))[0]
        ax_px, ay_px = float(cols.mean()) - x0, belly - y0 - 3
    else:
        x0, y0, x1, y1 = bbox(a)
        low = np.nonzero(a[max(y1-60, 0):y1+1] > 40); feet_x = (low[1].mean() if len(low[1]) else (x1-x0)/2) + (0 if len(low[1]) == 0 else 0)
        ax_px, ay_px = feet_x - (0) + 0, (y1 - y0) - 4   # a few px above the claw tips, so the feet sit on the line
        ax_px = (np.nonzero(a[max(y1-60, 0):y1+1] > 40)[1].mean() + 0) - x0 if len(low[1]) else (x1 - x0) / 2
    crop = img[y0:y1+1, x0:x1+1]
    if fid in ('rest-side','rest-back'): ax_px, ay_px = ax_px, ay_px
    w, h = int(round(crop.shape[1] * SCALE)), int(round(crop.shape[0] * SCALE))
    rgba = cv2.cvtColor(cv2.resize(crop, (w, h), interpolation=cv2.INTER_AREA), cv2.COLOR_BGRA2RGBA)
    Image.fromarray(rgba).save("sprite-%s.webp" % fid, "WEBP", quality=86, alpha_quality=92, method=6)
    table[fid] = dict(w=w, h=h, ax=round(ax_px / (x1 - x0 + 1), 4), ay=round(ay_px / (y1 - y0 + 1), 4), kind=kind)
json.dump(table, open("sprites.json", "w"), indent=1)
print(json.dumps(table))

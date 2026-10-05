"""Cut a bird out of its grey studio backdrop: seeds from the saturated blue and the dark pixels, GrabCut for the rest, a soft edge, then crop."""
import cv2, numpy as np, sys

def cutout(path, deshadow=False):
    bgr = cv2.imread(path); h, w = bgr.shape[:2]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    S, V = hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    blue = (S > 110) & (V > 70)                       # the plumage
    dark = (V < 105)                                   # claws, legs, wing tips, pupils
    seeds = (blue | dark).astype(np.uint8)
    seeds[: int(h*0.015)] = 0; seeds[-int(h*0.02):] = 0; seeds[:, : int(w*0.015)] = 0; seeds[:, -int(w*0.015):] = 0
    seeds = cv2.morphologyEx(seeds, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    # keep only seed blobs of a useful size (drop specks of noise)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(seeds, 8)
    keep = np.zeros_like(seeds)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] > 60: keep[lab == i] = 1
    ys, xs = np.nonzero(keep)
    hull = cv2.convexHull(np.stack([xs, ys], 1).astype(np.int32))
    hullmask = np.zeros((h, w), np.uint8); cv2.fillConvexPoly(hullmask, hull, 1)
    near = cv2.dilate(hullmask, np.ones((41, 41), np.uint8))        # where the bird may extend (white belly, feather fringes)
    mask = np.full((h, w), cv2.GC_BGD, np.uint8)
    mask[near > 0] = cv2.GC_PR_BGD
    mask[hullmask > 0] = cv2.GC_PR_FGD
    mask[cv2.erode(keep, np.ones((3, 3), np.uint8)) > 0] = cv2.GC_FGD
    bgm = np.zeros((1, 65)); fgm = np.zeros((1, 65))
    cv2.grabCut(bgr, mask, None, bgm, fgm, 6, cv2.GC_INIT_WITH_MASK)
    fg = ((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)).astype(np.uint8)
    # tidy: keep the biggest blob plus blobs touching it closely, fill pinholes
    n, lab, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
    big = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    out = (lab == big).astype(np.uint8)
    for i in range(1, n):   # small satellites (claw tips, separate feather ends) that sit near the main blob
        if i != big and stats[i, cv2.CC_STAT_AREA] > 30:
            comp = (lab == i).astype(np.uint8)
            if (cv2.dilate(out, np.ones((15, 15), np.uint8)) & comp).any(): out |= comp
    if deshadow:   # the soft grey floor shadow under a standing bird: unsaturated, mid-light, low in the picture; legs and claws are darker and stay
        ys2, xs2 = np.nonzero(out); top, bottom = ys2.min(), ys2.max()
        low = np.zeros_like(out, bool); low[int(top + 0.70 * (bottom - top)):] = True
        shadow = low & (S < 45) & (V < 212) & (V >= 125)
        out[shadow] = 0
        out = cv2.morphologyEx(out, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        n2, lab2, st2, _ = cv2.connectedComponentsWithStats(out, 8)
        big2 = 1 + np.argmax(st2[1:, cv2.CC_STAT_AREA]); out = (lab2 == big2).astype(np.uint8)
    out = cv2.morphologyEx(out, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    # holes inside the bird (between feathers) stay as they are; only fill tiny ones
    inv = (1 - out).astype(np.uint8); n, lab, stats, _ = cv2.connectedComponentsWithStats(inv, 4)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < 400 and stats[i, cv2.CC_STAT_LEFT] > 0 and stats[i, cv2.CC_STAT_TOP] > 0: out[lab == i] = 1
    # soft edge: erode a hair (drops the grey halo) then blur the mask
    soft = cv2.erode(out, np.ones((3, 3), np.uint8)).astype(np.float32)
    soft = cv2.GaussianBlur(soft, (0, 0), 1.2)
    alpha = np.clip((soft - 0.15) / 0.7, 0, 1)
    rgba = np.dstack([bgr, (alpha * 255).astype(np.uint8)])
    return rgba

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    r = cutout(src, deshadow=len(sys.argv) > 3 and sys.argv[3] == 'deshadow'); cv2.imwrite(dst, r)

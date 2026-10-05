# Photographed bluebird

Source: six photos of a bluebird (not in the repo). `cut.py <photo> <out.png> [deshadow]` cuts the bird out (GrabCut seeded from colour);
`pack.py` flips left-facing poses, crops, scales (0.4) and writes the WebP sprites plus the anchors that go in `src/lib/bird-sprites.ts`.
Needs `opencv-python` and `pillow`. Outputs live in `public/birds/`.

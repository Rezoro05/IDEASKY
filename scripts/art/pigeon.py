"""Generates the pigeon (seen from above, facing +x) as an SVG body for src/lib/forms.ts. `U` = unique id suffix."""
import math, sys

def lerp(a, b, t): return (a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t)
def bez(p0, p1, p2, t):  # quadratic point
    a = lerp(p0, p1, t); b = lerp(p1, p2, t); return lerp(a, b, t)
def f(n): return ("%.1f" % n).rstrip("0").rstrip(".")
def pt(p): return f(p[0]) + " " + f(p[1])

TAILU = 'x'
def feather(root, tip, width, cls):
    """A leaf-shaped feather from root to tip, `width` wide near the root, rounded at the tip."""
    dx, dy = tip[0]-root[0], tip[1]-root[1]; L = math.hypot(dx, dy); ux, uy = dx/L, dy/L; nx, ny = -uy, ux
    r1 = (root[0]+nx*width/2, root[1]+ny*width/2); r2 = (root[0]-nx*width/2, root[1]-ny*width/2)
    m1 = (root[0]+dx*.7+nx*width*.5, root[1]+dy*.7+ny*width*.5); m2 = (root[0]+dx*.7-nx*width*.5, root[1]+dy*.7-ny*width*.5)
    return '<path class="%s"%s d="M%s L%s Q%s %s Q%s %s Z"></path>' % (cls, (' fill="url(#bg-tail-%s)"' % TAILU) if 'bf-tail' in cls else '', pt(r1), pt(m1), pt((tip[0]+ux*1.2+nx*width*.45, tip[1]+uy*1.2+ny*width*.45)), pt(tip), pt(m2), pt(r2))

def wing(side, U):
    """side = -1 for the upper wing (y < 0), +1 for the lower. Mirrored by flipping y."""
    s = side
    def Y(p): return (p[0], p[1]*s) if True else p
    out = []
    # trailing-edge tips, outermost primary first; roots along the covert line from the wrist to the body
    prim_roots = [lerp((-1, -19), (3, -14), i/4) for i in range(5)]
    prim_tips  = [(-11, -29.5), (-14.5, -28.5), (-18, -26.5), (-20.5, -23.5), (-22, -19.5)]
    sec_roots  = [lerp((3, -13), (8, -5), i/5) for i in range(6)]
    sec_tips   = [lerp((-22, -17), (-14, -4.5), i/5) for i in range(6)]
    for i in reversed(range(5)): out.append(feather(Y(prim_roots[i]), Y(prim_tips[i]), 5.2, "bf bf-prim"))
    for i in reversed(range(6)): out.append(feather(Y(sec_roots[i]), Y(sec_tips[i]), 6.4, "bf bf-sec"))
    # coverts: a lighter shoulder over the feather roots
    # coverts: two rows of short rounded feathers over the roots, the shorter row nearer the body
    for i in range(6):
        out.append(feather(Y(lerp((-1.5, -20), (8, -4.5), i/5)), Y(lerp((-8.5, -19), (-1.5, -7.5), i/5)), 5.6, "bf bf-cov2"))
    for i in range(5):
        out.append(feather(Y(lerp((0, -19.5), (8.5, -4.2), i/4)), Y(lerp((-5, -18), (1.5, -6), i/4)), 5.0, "bf bf-cov"))
    # two dark wing bars across the secondaries
    for a, b in ((0.42, 0.5), (0.7, 0.78)):
        p1 = lerp(sec_roots[0], sec_tips[0], a); p2 = lerp(sec_roots[5], sec_tips[5], a)
        out.append('<path class="bf-bar" d="M%s L%s"></path>' % (pt(Y(p1)), pt(Y(p2))))
    # leading-edge highlight
    out.append('<path class="bf-edge" d="M%s C%s %s %s"></path>' % (pt(Y((9.4, -3.6))), pt(Y((8.4, -9.5))), pt(Y((4.5, -16.5))), pt(Y((-2.5, -22.5)))))
    cls = "wing wing-up" if s < 0 else "wing wing-down"
    return '<g class="%s">%s</g>' % (cls, "".join(out))

def bird(U):
    global TAILU; TAILU = U
    tail = []
    for i in range(7):
        a = (i-3) * 0.11
        tip = (-30.5 + abs(i-3)*0.8, 9.5*math.sin(a*2.9))
        tail.append(feather((-12, (i-3)*0.9), tip, 3.4, "bf bf-tail"))
    body = '<path class="bird-body" d="M15 0 C14.5 -4.2 8 -6.3 -1 -6 C-9 -5.8 -14 -3.6 -15 0 C-14 3.6 -9 5.8 -1 6 C8 6.3 14.5 4.2 15 0 Z" fill="url(#bg-body-%s)"></path>' % U
    rump = '<ellipse class="bird-rump" cx="-12.2" cy="0" rx="2.2" ry="4.3"></ellipse>'
    neck = '<path class="bird-neck" d="M17.5 -4.2 C14.5 -5.8 11 -5 9.6 -2.5 C8.8 0 8.8 0 9.6 2.5 C11 5 14.5 5.8 17.5 4.2 Z" fill="url(#bg-neck-%s)"></path>' % U
    head = '<ellipse class="bird-head" cx="19.2" cy="0" rx="4.1" ry="3.7" fill="url(#bg-head-%s)"></ellipse>' % U
    beak = '<path class="bird-beak" d="M22.8 -1.1 L27.6 -0.35 Q28.4 0 27.6 0.35 L22.8 1.1 Z"></path><ellipse class="bird-cere" cx="23.2" cy="0" rx=".95" ry="1"></ellipse>'
    eyes = '<circle class="bird-eye" cx="20.7" cy="-2.9" r=".95"></circle><circle class="bird-eye" cx="20.7" cy="2.9" r=".95"></circle><circle class="bird-pupil" cx="20.95" cy="-2.9" r=".42"></circle><circle class="bird-pupil" cx="20.95" cy="2.9" r=".42"></circle>'
    spine = '<path class="bird-spine" d="M13 0 L-13 0"></path>'
    defs = ('<defs>'
      '<linearGradient id="bg-body-%s" x1="0" y1="-6" x2="0" y2="6" gradientUnits="userSpaceOnUse"><stop offset="0" class="s-hi"/><stop offset=".5" class="s-mid"/><stop offset="1" class="s-lo"/></linearGradient>'
      '<linearGradient id="bg-neck-%s" x1="0" y1="-5" x2="0" y2="5" gradientUnits="userSpaceOnUse"><stop offset="0" class="s-sheen1"/><stop offset=".5" class="s-sheen2"/><stop offset="1" class="s-sheen1"/></linearGradient>'
      '<linearGradient id="bg-tail-%s" x1="-12" y1="0" x2="-31" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" class="s-lo"/><stop offset=".6" class="s-lo"/><stop offset=".66" class="s-dark"/><stop offset="1" class="s-dark"/></linearGradient>'
      '<radialGradient id="bg-head-%s" cx=".4" cy=".35" r=".8"><stop offset="0" class="s-hi"/><stop offset="1" class="s-lo"/></radialGradient>'
      '</defs>') % (U, U, U, U)
    return defs + "".join(tail) + wing(+1, U) + wing(-1, U) + body + rump + spine + neck + head + beak + eyes

if __name__ == "__main__":
    print(bird(sys.argv[1] if len(sys.argv) > 1 else "x"))

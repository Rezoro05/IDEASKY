/** Draws the private sky's San Francisco picture, in the New York picture's flat style and colours (2026-10-19, owner: "you draw it").
 *  The 3D sky is built from the picture (lib/skyline-splats), which reads lightness as distance: near is dark navy, far is pale haze.
 *  So the layers keep New York's palette: sky #66b1e9 → #e2ebf8, far #6e8fb2 and paler, middle #5279a5, near #2b4f7a, water #6d99c1 → #77b8e9.
 *  Same size as public/skyline.* (1983 × 793, shore at 80%). Run: node scripts/draw-san-francisco.mjs  → public/sf-skyline.{avif,webp} */
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const W = 1983, H = 793, SHORE = 636;
let seed = 20261019;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const between = (lo, hi) => lo + (hi - lo) * rand();
const r1 = (n) => Math.round(n * 10) / 10;

/** A cloud like New York's: cream puffs on a flat base, blue shade underneath. */
function cloud(cx, cy, w, puffs) {
  let top = "", shade = "";
  for (let i = 0; i < puffs; i++) {
    const t = i / (puffs - 1), x = cx - w / 2 + t * w, r = (0.35 + 0.65 * Math.sin(Math.PI * t)) * w * 0.16 + between(4, 14);
    top += `<circle cx="${r1(x)}" cy="${r1(cy - r * 0.55)}" r="${r1(r)}"/>`;
  }
  shade = `<ellipse cx="${cx}" cy="${cy + 4}" rx="${w * 0.55}" ry="${w * 0.05 + 6}"/>`;
  return `<g fill="#8ec6f1" opacity=".9">${shade}</g><g fill="#efe8e6">${top}<rect x="${cx - w * 0.5}" y="${cy - 10}" width="${w}" height="12" rx="6"/></g>`;
}
const wisp = (x, y, w) => `<path d="M${x} ${y} q ${w * 0.3} -10 ${w * 0.6} -2 t ${w * 0.4} 4" fill="none" stroke="#f4f0ea" stroke-width="5" stroke-linecap="round" opacity=".85"/>`;

/** A row of plain towers between x0 and x1: heights in [lo, hi] above the shore. */
function towers(x0, x1, lo, hi, fill, gapMax = 6) {
  let s = "", x = x0;
  while (x < x1) {
    const w = between(16, 46), h = between(lo, hi), top = SHORE - h;
    const cap = rand() < 0.25 ? `<rect x="${r1(x + w * 0.25)}" y="${r1(top - 10)}" width="${r1(w * 0.5)}" height="12"/>` : "";
    s += `<rect x="${r1(x)}" y="${r1(top)}" width="${r1(w)}" height="${r1(h + 4)}"/>${cap}`;
    x += w + between(0, gapMax);
  }
  return `<g fill="${fill}">${s}</g>`;
}

/** The Golden Gate: two Art Deco towers, the main cables and the suspenders, all in the near navy. */
function goldenGate() {
  const deck = 572, color = "#24476f", towersX = [170, 560], top = 248;
  let s = `<g fill="${color}" stroke="none">`;
  for (const tx of towersX) {
    // two legs that narrow as they rise, joined by stepped portals with sky showing between
    s += `<path d="M${tx - 22} ${SHORE} L${tx - 17} ${top} L${tx - 7} ${top} L${tx - 9} ${SHORE} Z"/>`;
    s += `<path d="M${tx + 22} ${SHORE} L${tx + 17} ${top} L${tx + 7} ${top} L${tx + 9} ${SHORE} Z"/>`;
    for (const y of [top, top + 70, top + 135, top + 195, deck - 10]) s += `<rect x="${tx - 20}" y="${y}" width="40" height="${y === top ? 14 : 9}"/>`;
    s += `<rect x="${tx - 14}" y="${top - 12}" width="28" height="12"/>`;
  }
  s += `<rect x="-10" y="${deck}" width="${towersX[1] + 170}" height="11"/>`; // the deck, out to the city shore
  // where it lands: a headland (the Presidio) under the deck's end, and a pier holding the approach
  s += `<path d="M${towersX[1] + 40} ${SHORE} Q ${towersX[1] + 90} ${deck + 6} ${towersX[1] + 150} ${deck + 4} L${towersX[1] + 210} ${deck + 6} Q ${towersX[1] + 250} ${deck + 30} ${towersX[1] + 290} ${SHORE} Z"/>`;
  s += `<rect x="${towersX[1] + 70}" y="${deck}" width="10" height="${SHORE - deck}"/>`;
  s += `</g>`;
  // main cables: side span, main span (sagging to the deck), side span
  const [a, b] = towersX, mid = (a + b) / 2, sag = deck - 6;
  const cable = `M-10 ${deck - 60} Q ${a * 0.55} ${deck - 30} ${a} ${top + 4} Q ${mid} ${sag + (sag - top) * 0.95} ${b} ${top + 4} Q ${b + 90} ${deck - 40} ${b + 160} ${deck - 2}`;
  s += `<path d="${cable}" fill="none" stroke="${color}" stroke-width="4"/>`;
  // suspenders: the cable's height under each, along the main span (a parabola through the tower tops and the low point)
  let hangers = "";
  for (let x = a + 12; x < b - 6; x += 13) {
    const t = (x - a) / (b - a), y = top + 4 + (sag - top - 4) * (1 - (2 * t - 1) ** 2) * 0.97;
    hangers += `M${x} ${r1(y)} V${deck}`;
  }
  for (let x = 4; x < a - 6; x += 13) { const t = x / a, y = deck - 60 + (top + 4 - deck + 60) * t ** 1.6; hangers += `M${x} ${r1(y)} V${deck}`; }
  s += `<path d="${hangers}" stroke="${color}" stroke-width="1.3" opacity=".75"/>`;
  return s;
}

/** The Bay Bridge's western span, small and far on the right (like the Brooklyn Bridge in New York's picture). */
function bayBridge() {
  const deck = 592, color = "#3a5f8b", towersX = [1790, 1925], top = 486;
  let s = `<g fill="${color}">`;
  for (const tx of towersX) s += `<rect x="${tx - 6}" y="${top}" width="12" height="${SHORE - top}"/><rect x="${tx - 11}" y="${top + 26}" width="22" height="5"/><rect x="${tx - 11}" y="${top + 60}" width="22" height="5"/>`;
  s += `<rect x="1700" y="${deck}" width="300" height="7"/></g>`;
  const [a, b] = towersX;
  s += `<path d="M1700 ${deck - 4} Q ${(1700 + a) / 2} ${deck - 30} ${a} ${top + 2} Q ${(a + b) / 2} ${deck + 30} ${b} ${top + 2} Q ${b + 40} ${deck - 40} 2000 ${deck - 50}" fill="none" stroke="${color}" stroke-width="2.4"/>`;
  return s;
}

/** The city: far haze, then the middle with the landmarks, then the near low blocks and Telegraph Hill with Coit Tower. */
function city() {
  const far = towers(760, 1700, 40, 150, "#8ba7c5", 10) + towers(800, 1660, 30, 110, "#7f9dbf", 14);
  const mid = towers(820, 1640, 60, 210, "#6e8fb2", 8);
  // Landmarks, mid tone so they read against the sky
  const transamerica = `<path d="M1010 ${SHORE} L1036 205 L1062 ${SHORE} Z" fill="#5279a5"/><path d="M1033 238 L1026 246 L1028 300 L1032 300 Z M1039 238 L1046 246 L1044 300 L1040 300 Z" fill="#5279a5"/><rect x="1034" y="175" width="4" height="32" fill="#5279a5"/>`;
  const salesforce = `<path d="M1206 ${SHORE} L1210 236 Q1232 180 1254 236 L1258 ${SHORE} Z" fill="#6383ac"/><path d="M1222 240 L1224 ${SHORE}" stroke="#7d9cc0" stroke-width="3"/>`;
  const fremont = `<path d="M1292 ${SHORE} L1294 300 L1312 286 L1330 300 L1332 ${SHORE} Z" fill="#5a7fab"/><rect x="1310" y="250" width="3" height="38" fill="#5a7fab"/>`;
  const california555 = `<rect x="1104" y="300" width="58" height="${SHORE - 300}" fill="#3d628f"/><path d="M1104 300 h58 v12 h-58 z" fill="#36597f"/>`;
  const embarcadero = `<rect x="1360" y="390" width="40" height="${SHORE - 390}" fill="#4b719d"/><rect x="1406" y="410" width="34" height="${SHORE - 410}" fill="#53789f"/><rect x="1446" y="430" width="30" height="${SHORE - 430}" fill="#4b719d"/>`;
  const landmarks = transamerica + california555 + salesforce + fremont + embarcadero;
  const near = towers(820, 1690, 18, 96, "#2b4f7a", 4);
  const telegraph = `<path d="M690 ${SHORE} Q 760 520 860 ${SHORE} Z" fill="#284b75"/><rect x="764" y="512" width="16" height="80" fill="#284b75"/><rect x="761" y="508" width="22" height="7" fill="#284b75"/>`;
  return far + mid + landmarks + telegraph + near;
}

/** Hills behind it all: the Marin Headlands left, Twin Peaks with Sutro Tower right, pale with distance. */
function hills() {
  const marin = `<path d="M-10 ${SHORE} L-10 470 Q 60 430 150 455 Q 260 488 360 520 Q 480 560 640 ${SHORE} Z" fill="#9ab7d4"/>`;
  const twin = `<path d="M1280 ${SHORE} Q 1380 470 1470 476 Q 1520 440 1570 470 Q 1620 448 1680 486 Q 1760 540 1840 ${SHORE} Z" fill="#a4bfda"/>`;
  const sutro = `<g stroke="#8eaacb" stroke-width="3" fill="none"><path d="M1540 462 L1556 330 L1572 462 M1556 330 V300 M1534 352 H1578 M1530 392 H1582"/><path d="M1546 310 V340 M1566 310 V340"/></g>`;
  return marin + twin + sutro;
}

const fog = `<g filter="url(#soft)" fill="#f3f6fb" opacity=".72"><ellipse cx="200" cy="590" rx="330" ry="30"/><ellipse cx="520" cy="602" rx="260" ry="22"/><ellipse cx="60" cy="560" rx="160" ry="36"/></g>`;

const skyline = hills() + fog + city() + bayBridge() + goldenGate()
  + `<path d="M-10 ${SHORE - 8} Q 300 ${SHORE - 14} 700 ${SHORE - 6} T 1400 ${SHORE - 9} T 2000 ${SHORE - 6} V${SHORE + 2} H-10 Z" fill="#284f7b"/>`;

// Reflections: the skyline flipped about the shore, squashed and faded, broken into ripple bands
let ripples = "";
for (let y = SHORE + 2; y < H; y += between(5, 11)) { const h = between(2, 6), x = between(-40, 30); ripples += `<rect x="${r1(x)}" y="${r1(y)}" width="${W + 80}" height="${r1(h)}"/>`; }

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#66b1e9"/><stop offset=".45" stop-color="#8ec7ef"/><stop offset=".8" stop-color="#d4e6f7"/></linearGradient>
  <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d99c1"/><stop offset="1" stop-color="#77b8e9"/></linearGradient>
  <filter id="soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
  <mask id="ripples"><g fill="#fff">${ripples}</g></mask>
  <g id="land">${skyline}</g>
</defs>
<rect width="${W}" height="${SHORE}" fill="url(#sky)"/>
${cloud(120, 300, 300, 9)}${cloud(250, 220, 200, 7)}${cloud(1830, 300, 320, 9)}${cloud(1700, 230, 210, 7)}${cloud(1340, 140, 120, 5)}
${wisp(260, 120, 160)}${wisp(1470, 90, 200)}${wisp(820, 160, 120)}${wisp(1150, 110, 90)}
<use href="#land"/>
<rect y="${SHORE}" width="${W}" height="${H - SHORE}" fill="url(#water)"/>
<g mask="url(#ripples)" opacity=".42"><use href="#land" transform="translate(0 ${SHORE * 1.55}) scale(1 -0.55)"/></g>
</svg>`;

// (The reflection is the skyline flipped about the shore and squashed: y' = SHORE + (SHORE - y) * 0.55.)
if (process.argv[2]) writeFileSync(process.argv[2], svg); // optional: keep the SVG to look at
const png = await sharp(Buffer.from(svg)).png().toBuffer();
await sharp(png).webp({ quality: 82 }).toFile(new URL("../public/sf-skyline.webp", import.meta.url).pathname);
await sharp(png).avif({ quality: 55 }).toFile(new URL("../public/sf-skyline.avif", import.meta.url).pathname);
console.log("public/sf-skyline.webp and .avif written");

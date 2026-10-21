// Витатен — 12 s square sting. seek(f) draws frame f (29.97 fps frame units, fractional allowed).
'use strict';

// ---------- copy ----------
const T = {
  name: 'Витатен',
  pill: 'MEGAVIT',
  search: 'Қидириш',
  courseTitle: 'Витатен сиропи',
  courseSub: 'Мультивитамин · 200 мл',
  prompt: 'Болам учун витамин тавсия қил',
  date: 'Душ 22 июн  9:41',
  crumb: 'Мегавит  ›  Сироплар',
  title: 'Витатен — бутун оила учун',
  bodyA: 'Витатен — шакарсиз мультивитаминли сироп. Болалар ва катталар учун кунлик витаминлар',
  key: 'бир қошиқда.',
  bodyB: 'Шакарсиз, 200 мл. Кунига бир марта, овқатдан кейин — болалар ва катталар учун.',
  cardCap: 'Витатен сиропи',
  cardSub: 'Мультивитаминли · шакарсиз · 200 мл',
  tagline: 'мультивитаминли сироп',
  c1: 'Иммунитет', c1pill: 'Витамин C',
  c2: 'Энергия', c2pill: 'Витамин B',
  site: 'aksonmegavit.uz',
};

// ---------- palette (brand colours from the MegavitFarm logo mapped onto the roles) ----------
const C = {
  page: '#FDFDFB', haze: '#B7CFEB', ice: '#E6F0FA', floor: '#DBEEFD',
  deep: '#0F45A8', sky: '#7AAEE8', navy: '#0B2A66',
  blue: '#1E6FE0', lblue: '#3C9BF0', green: '#3BAA2E', lgreen: '#7ED321', white: '#FFFFFF',
};

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
  lin: t => t,
  io: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  in: t => t * t * t,
  inq: t => t * t,
  out: t => 1 - Math.pow(1 - t, 3),
  // exponential ease-out: ~15% of the remaining distance per step
  expo: t => (t >= 1 ? 1 : (1 - Math.pow(2, -8 * t)) / (1 - Math.pow(2, -8))),
};
// keyframes [[f, v], ...]; ease is one function or one per segment
function kf(f, tab, ease = E.lin) {
  if (f <= tab[0][0]) return tab[0][1];
  for (let i = 0; i < tab.length - 1; i++) {
    const [a, va] = tab[i], [b, vb] = tab[i + 1];
    if (f <= b) {
      const e = typeof ease === 'function' ? ease : ease[i] || E.lin;
      return lerp(va, vb, e((f - a) / (b - a)));
    }
  }
  return tab[tab.length - 1][1];
}
// monotone cubic lookup table (Fritsch–Carlson), constant outside its range
function mono(tab) {
  const n = tab.length, xs = tab.map(p => p[0]), ys = tab.map(p => p[1]);
  const d = [], m = [];
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const hex2 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hex2(a), B = hex2(b); return 'rgb(' + A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',') + ')'; };
const n2 = v => (Math.round(v * 100) / 100).toString();
const deriv = (fn, f) => fn(f + 0.5) - fn(f - 0.5);

// ---------- per-frame defs registry ----------
let DEFS = [], FID = 0;
const uid = p => p + (FID++);
function blur(sx, sy = sx) {
  sx = Math.max(0, sx); sy = Math.max(0, sy);
  if (sx < 0.05 && sy < 0.05) return '';
  const id = uid('b');
  DEFS.push(`<filter id="${id}" filterUnits="userSpaceOnUse" x="-1200" y="-1200" width="3480" height="3480" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${n2(sx)} ${n2(sy)}"/></filter>`);
  return `filter="url(#${id})"`;
}
// wrap content (drawn around 0,0) with a blur along angle ang (deg), placed at x,y
function dirBlur(inner, x, y, ang, amt, round = 0) {
  return `<g transform="translate(${n2(x)},${n2(y)}) rotate(${n2(ang)})"><g ${blur(amt + round, amt * 0.1 + round)}><g transform="rotate(${n2(-ang)})">${inner}</g></g></g>`;
}
function velBlur(inner, x, y, vx, vy, k = 0.22, cap = 24, round = 0) {
  const sp = Math.hypot(vx, vy);
  return dirBlur(inner, x, y, Math.atan2(vy, vx) * 180 / Math.PI, Math.min(cap, sp * k), round);
}
function clip(shape) { const id = uid('c'); DEFS.push(`<clipPath id="${id}">${shape}</clipPath>`); return `clip-path="url(#${id})"`; }
function grad(stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1, units = 'objectBoundingBox') {
  const id = uid('g');
  DEFS.push(`<linearGradient id="${id}" gradientUnits="${units}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2] ?? 1}"/>`).join('')}</linearGradient>`);
  return `url(#${id})`;
}
function rgrad(stops, cx = 0.5, cy = 0.5, r = 0.5, fx = cx, fy = cy, units = 'objectBoundingBox') {
  const id = uid('r');
  DEFS.push(`<radialGradient id="${id}" gradientUnits="${units}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}">${stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2] ?? 1}"/>`).join('')}</radialGradient>`);
  return `url(#${id})`;
}
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ---------- static defs ----------
const STATIC = `
<linearGradient id="gBlue" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#1A86F5"/><stop offset="1" stop-color="#0B44B4"/></linearGradient>
<linearGradient id="gGreen" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FD82A"/><stop offset="1" stop-color="#2E9A2E"/></linearGradient>
<linearGradient id="gIcon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B55BE"/><stop offset="1" stop-color="${C.navy}"/></linearGradient>
<filter id="cshadow" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.8" flood-color="#000" flood-opacity=".38"/></filter>
<filter id="softShadow" filterUnits="userSpaceOnUse" x="-1200" y="-1200" width="3480" height="3480"><feDropShadow dx="0" dy="14" stdDeviation="22" flood-color="#0B2A66" flood-opacity=".13"/></filter>
<filter id="faintShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0B2A66" flood-opacity=".14"/></filter>
`;

// ---------- brand mark (MegavitFarm "M": capsule + leaf), traced into vector ----------
function markPaths(v) {
  const W = v === 'white';
  const blue = W ? '#FFFFFF' : 'url(#gBlue)', green = W ? '#FFFFFF' : 'url(#gGreen)';
  const capBot = W ? 'rgba(255,255,255,.72)' : 'url(#gBlue)';
  const gap = W ? C.navy : '#FFFFFF';
  return `
<path fill="${blue}" d="M376,495 L376,222 Q376,174 424,175 Q448,176 470,194 L470,495 A47,47 0 0 1 376,495 Z"/>
<path fill="${blue}" d="M392,190 L452,176 L628,312 L590,384 L470,272 L382,232 Z"/>
<path fill="${blue}" d="M812,300 L905,252 L905,495 A46.5,46.5 0 0 1 812,495 Z"/>
<rect x="580" y="360" width="76" height="182" rx="38" fill="${capBot}"/>
<path fill="${green}" d="M580,451 L580,398 A38,38 0 0 1 656,398 L656,451 Z"/>
<line x1="580" y1="451" x2="656" y2="451" stroke="${gap}" stroke-width="6"/>
<path d="M598,392 L598,428" stroke="${W ? C.navy : '#FFFFFF'}" stroke-opacity=".7" stroke-width="7" stroke-linecap="round"/>
<path fill="${green}" d="M664,446 C640,330 720,170 920,104 C948,232 890,336 800,372 C744,394 700,412 664,446 Z"/>
<path d="M672,430 C730,330 800,262 892,168" stroke="${gap}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
}
const mark = (cx, cy, w, v = 'color') => `<g transform="translate(${n2(cx)},${n2(cy)}) scale(${n2(w / 544 * 1000) / 1000}) translate(-648,-323)">${markPaths(v)}</g>`;

// ---------- cursor: one macOS arrow, hotspot at its tip ----------
const ARROW = 'M0,0 L0,28.5 L6.6,22.2 L11,32.6 L15.6,30.7 L11.3,20.5 L20.3,20.5 Z';
function cursor(x, y, rot, sc, op = 1, vx = 0, vy = 0) {
  if (op <= 0) return '';
  const g = `<g transform="rotate(${n2(rot)}) scale(${n2(1.22 * sc)})"><g filter="url(#cshadow)"><path d="${ARROW}" fill="#000" stroke="#fff" stroke-width="2.1" stroke-linejoin="round"/></g></g>`;
  return `<g opacity="${n2(op)}">${velBlur(g, x, y, vx, vy, 0.16, 14)}</g>`;
}

// ---------- text measuring (only after fonts load) ----------
const CV = document.createElement('canvas').getContext('2d');
function tw(s, wt, size, ls = 0) { CV.font = `${wt} ${size}px IN`; return CV.measureText(s).width + ls * s.length; }
const txt = (x, y, s, wt, size, fill, extra = '') => `<text x="${n2(x)}" y="${n2(y)}" font-weight="${wt}" font-size="${n2(size)}" fill="${fill}" ${extra}>${esc(s)}</text>`;

// ---------- procedural cover art (no text baked in) ----------
function cloud(cx, cy, s, op) {
  return `<g opacity="${op}"><ellipse cx="${cx}" cy="${cy}" rx="${70 * s}" ry="${34 * s}" fill="#fff"/><circle cx="${cx - 30 * s}" cy="${cy - 18 * s}" r="${34 * s}" fill="#fff"/><circle cx="${cx + 18 * s}" cy="${cy - 30 * s}" r="${42 * s}" fill="#fff"/></g>`;
}
// the real Vitaten box (photo, 579x1254), standing at bottom-centre bx,by with height h
const BOX_AR = 579 / 1254;
function box(bx, by, h, shadow = true) {
  const w = h * BOX_AR, x = bx - w / 2, y = by - h;
  return `${shadow ? `<g ${blur(h * 0.03, h * 0.012)}><ellipse cx="${n2(bx)}" cy="${n2(by + h * 0.008)}" rx="${n2(w * 0.62)}" ry="${n2(h * 0.022)}" fill="#0B2A66" opacity=".32"/></g>` : ''}
<g ${clip(`<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" rx="${n2(h * 0.006)}"/>`)}>
<image href="box.png" x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" preserveAspectRatio="none"/>
<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" fill="${grad([[0, '#FFFFFF', 0.22], [0.18, '#FFFFFF', 0], [0.86, '#0B2A66', 0], [1, '#0B2A66', 0.16]], 0, 0, 1, 0)}"/>
</g>`;
}
// product hero art: sky, clouds, hill and the box standing on it
function artBox(x, y, w, h) {
  const s = w / 627;
  const clouds = [0, 1, 2, 3].map(i => cloud(x + w * (0.08 + 0.29 * i + 0.05 * hash(i)), y + h * (0.14 + 0.16 * hash(i + 9)), s * (0.8 + 0.5 * hash(i + 3)), 0.85)).join('');
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${grad([[0, '#79B6F2'], [0.65, '#CFE7FF'], [1, '#E9F5FF']])}"/>
<g ${blur(6 * s)}>${clouds}</g>
<path d="M${x},${y + h * 0.8} C${x + w * 0.3},${y + h * 0.72} ${x + w * 0.62},${y + h * 0.76} ${x + w},${y + h * 0.7} L${x + w},${y + h} L${x},${y + h} Z" fill="${grad([[0, '#8ED84A'], [1, '#3BAA2E']])}"/>
${box(x + w * 0.5, y + h * 0.93, h * 0.86)}`;
}
function artImmun(x, y, w, h) {
  const balls = [[0.2, 0.3, 0.2, C.lblue], [0.72, 0.26, 0.26, '#FFFFFF'], [0.52, 0.62, 0.17, C.lgreen], [0.88, 0.7, 0.12, C.lblue], [0.1, 0.78, 0.13, '#9CD3FF'], [0.38, 0.12, 0.08, C.lgreen]];
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${grad([[0, '#0F45A8'], [1, '#3C9BF0']], 0, 0, 1, 1)}"/>
<circle cx="${x + w * 0.85}" cy="${y + h * 0.1}" r="${w * 0.45}" fill="${rgrad([[0, '#7FD3FF', 0.55], [1, '#7FD3FF', 0]])}"/>
${balls.map(([bx, by, r, c]) => `<circle cx="${x + w * bx}" cy="${y + h * by}" r="${w * r * 0.5}" fill="${rgrad([[0, '#FFFFFF', 0.95], [0.35, c, 0.95], [1, c, 0.55]], 0.5, 0.5, 0.5, 0.32, 0.28)}"/>`).join('')}
<path d="M${x + w * 0.6},${y + h * 0.95} C${x + w * 0.62},${y + h * 0.62} ${x + w * 0.8},${y + h * 0.46} ${x + w * 1.02},${y + h * 0.42} C${x + w * 1.0},${y + h * 0.7} ${x + w * 0.84},${y + h * 0.86} ${x + w * 0.6},${y + h * 0.95} Z" fill="${grad([[0, '#8FD82A'], [1, '#2E9A2E']])}" opacity=".9"/>`;
}
function artEnergy(x, y, w, h) {
  const waves = [0, 1, 2, 3, 4].map(i => {
    const yy = y + h * (0.35 + i * 0.12), a = h * (0.08 + 0.03 * hash(i + 21));
    return `<path d="M${x - 20},${yy} C${x + w * 0.25},${yy - a} ${x + w * 0.5},${yy + a} ${x + w * 0.75},${yy - a * 0.6} S${x + w + 40},${yy + a * 0.5} ${x + w + 40},${yy}" stroke="#fff" stroke-opacity="${0.22 + 0.1 * i}" stroke-width="${10 + i * 5}" fill="none"/>`;
  }).join('');
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${grad([[0, '#2E86E8'], [0.55, '#4FB6E8'], [1, '#5ED3A8']], 0, 0, 0.4, 1)}"/>
<circle cx="${x + w * 0.78}" cy="${y + h * 0.22}" r="${w * 0.32}" fill="${rgrad([[0, '#FFFFFF', 0.95], [0.25, '#E9FBFF', 0.7], [1, '#E9FBFF', 0]])}"/>
${waves}
<circle cx="${x + w * 0.2}" cy="${y + h * 0.3}" r="${w * 0.07}" fill="${rgrad([[0, '#FFFFFF', 0.95], [1, C.lgreen, 0.8]], 0.5, 0.5, 0.5, 0.35, 0.3)}"/>`;
}

// ---------- layout measured after fonts load ----------
let L = {};
function layout() {
  // S1 lockup: disc 132, name, pill; scaled to span x474–1063
  const nameFs = 84, pillFs = 30, pillLs = 1.5;
  const nameW = tw(T.name, 500, nameFs), pillW = tw(T.pill, 600, pillFs, pillLs) + 56;
  const W0 = 132 + 30 + nameW + 22 + pillW;
  L.lock = { nameFs, pillFs, pillLs, nameW, pillW, s: 589 / W0 };
  // S3 prompt size
  L.promptFs = Math.min(40, 40 * 620 / tw(T.prompt, 500, 40));
  // S4 page text
  const colW = 840;
  L.titleFs = Math.min(64, 64 * colW / tw(T.title, 700, 64));
  const words = T.bodyA.split(' ').map(w => ({ w, key: false })).concat([{ w: T.key, key: true }]);
  const lines = [[]]; let lx = 0;
  const sp = tw(' ', 400, 47);
  for (const t of words) {
    const ww = tw(t.w, t.key ? 600 : 400, 47);
    if (lx > 0 && lx + ww > colW) { lines.push([]); lx = 0; }
    lines[lines.length - 1].push({ ...t, x: 120 + lx, ww });
    lx += ww + sp;
  }
  L.lines = lines;
  const kl = lines.findIndex(l => l.some(t => t.key)), kt = lines[kl].find(t => t.key);
  L.body0 = 500;
  L.keyX = kt.x + kt.ww * 0.5; L.keyY = L.body0 + kl * 58 + 22;
  const linesB = [[]]; lx = 0;
  for (const w of T.bodyB.split(' ')) {
    const ww = tw(w, 400, 47);
    if (lx > 0 && lx + ww > colW) { linesB.push([]); lx = 0; }
    linesB[linesB.length - 1].push({ w, x: 120 + lx }); lx += ww + sp;
  }
  L.linesB = linesB; L.bodyB0 = L.body0 + (lines.length + 1) * 58 + 10;
  // S6 glass titles: one size for both, fitting the 538 card with margins
  L.cardFs = Math.min(150, 150 * 494 / Math.max(tw(T.c1, 700, 150, -3), tw(T.c2, 700, 150, -3)));
  // S8 wordmark width per 100 px
  L.word100 = tw(T.name, 600, 100);
}

// ======================================================================
// S1 f0–71  header + hub window + click
// ======================================================================
const HY = mono([[0, 932], [2, 776], [5, 683], [10, 608], [24, 546], [37, 536]]);
const headerY = f => (f <= 37 ? HY(f) : 536 - (f - 37));
const expoTo = (f, f0, f1, a, b, k = 0.85) => {
  const n = f1 - f0, t = clamp((f - f0) / n);
  return lerp(a, b, (1 - Math.pow(k, t * n)) / (1 - Math.pow(k, n)));
};
const CX1 = mono([[44, 770], [47, 761], [51, 706], [56, 629], [59, 587], [63, 566], [71, 555]]);
const CY1 = mono([[44, 383], [47, 394], [51, 470], [56, 564], [59, 546], [63, 536], [71, 531]]);
const cur1 = f => (f <= 44 ? [expoTo(f, 27, 44, 891, 770), expoTo(f, 27, 44, 393, 383)] : [CX1(f), CY1(f)]);
const ROT1 = mono([[27, -28], [44, -42], [47, -48], [51, -118], [56, -112], [60, -56], [71, -52]]);
const SC1 = mono([[55, 1], [60, 1.55], [69, 1.55], [70, 1.38], [71, 1.32]]);

function hubWindow(f, dy, sc) {
  const cl = clip(`<rect x="408" y="405" width="1100" height="1000" rx="93"/>`);
  return `<g transform="translate(540,${n2(540 + dy)}) scale(${n2(sc)}) translate(-540,-540)">
<rect x="408" y="405" width="1100" height="1000" rx="93" fill="#FCFDFF" stroke="#E3EAF4" filter="url(#softShadow)"/>
<g ${cl}>
<rect x="408" y="405" width="1100" height="66" fill="#F1F6FF"/>
<line x1="408" y1="471" x2="1508" y2="471" stroke="#E2EAF5"/>
<ellipse cx="760" cy="1120" rx="620" ry="250" fill="${rgrad([[0, '#D6E8FF', 0.95], [1, '#D6E8FF', 0]])}"/>
<circle cx="474" cy="438" r="8" fill="#D9E3F0"/><circle cx="502" cy="438" r="8" fill="#D9E3F0"/>
<rect x="640" y="418" width="360" height="40" rx="20" fill="#FFFFFF" stroke="#DEE6F1"/>
<circle cx="668" cy="436" r="7.5" fill="none" stroke="#9BA9BD" stroke-width="2.2"/><line x1="674" y1="442" x2="680" y2="448" stroke="#9BA9BD" stroke-width="2.2" stroke-linecap="round"/>
${txt(692, 445, T.search, 500, 20, '#9BA9BD')}
<rect x="505" y="707" width="64" height="64" rx="18" fill="#E6F0FF"/>
<path d="M521,725 h14 a6,6 0 0 1 6,6 v24 a5,5 0 0 0 -5,-5 h-15 z M553,725 h-12 v25 h12 z" fill="none" stroke="${C.blue}" stroke-width="3" stroke-linejoin="round"/>
<g opacity=".38"><rect x="505" y="868" width="64" height="64" rx="18" fill="#EEF2F8"/>
<path d="M521,886 h32 a5,5 0 0 1 5,5 v16 a5,5 0 0 1 -5,5 h-18 l-9,8 v-8 h-5 a5,5 0 0 1 -5,-5 v-16 a5,5 0 0 1 5,-5 z" fill="none" stroke="#6C7A90" stroke-width="3" stroke-linejoin="round"/></g>
<rect x="764" y="700" width="440" height="560" rx="40" fill="#FFFFFF" stroke="#E6ECF4" filter="url(#softShadow)"/>
<g ${clip(`<rect x="780" y="716" width="408" height="232" rx="28"/>`)}>${artBox(780, 716, 408, 232)}</g>
${txt(784, 996, T.courseTitle, 600, 30, '#14181F')}
${txt(784, 1034, T.courseSub, 500, 22, '#8D96A5')}
</g></g>`;
}

function lockup(f, y, vy) {
  const s = L.lock.s, k = L.lock;
  const nameOp = clamp((f - 1.5) / 1), pillOp = clamp((f - 3.5) / 1.5);
  const ringOp = E.out(clamp((f - 53) / 6)), ringS = lerp(0.9, 1, E.out(clamp((f - 53) / 8)));
  const press = kf(f, [[68.5, 1], [70.5, 0.965], [71.5, 0.975]]);
  const pillX = 162 + k.nameW + 22 + kf(f, [[4, 15], [12, 0]], E.out);
  const inner = `<g transform="scale(${n2(s)})">
${ringOp > 0 ? `<circle cx="66" cy="0" r="${n2(87 * ringS)}" fill="${rgrad([[0, '#D5F3FF'], [0.72, '#D5F3FF'], [1, '#F7FEFF']])}" opacity="${n2(ringOp)}"/>` : ''}
<g transform="translate(66,0) scale(${n2(press)})"><circle cx="0" cy="0" r="66" fill="#FBFCFE" stroke="#E8E8EA"/>${mark(0, 1, 82)}</g>
${nameOp > 0 ? `<g opacity="${n2(nameOp)}" ${blur(kf(f, [[2, 10], [8, 0]], E.out))}>${txt(162, k.nameFs * 0.36, T.name, 500, k.nameFs, '#121417')}</g>` : ''}
${pillOp > 0 ? `<g opacity="${n2(pillOp)}" ${blur(kf(f, [[4, 16], [5, 13], [12, 0]], E.out))}><rect x="${n2(pillX)}" y="-32" width="${n2(k.pillW)}" height="64" rx="32" fill="#2F2E2F"/>${txt(pillX + 28, 11, T.pill, 600, k.pillFs, '#FFFFFF', `letter-spacing="${k.pillLs}"`)}</g>` : ''}
</g>`;
  return velBlur(inner, 474, y, 0, vy, 0.2, 26);
}

const S1 = {
  f0: 0, f1: 71,
  render(f) {
    const bg = mix(C.haze, C.page, E.out(clamp(f / 28)));
    const z = kf(f, [[46, 1], [60, 1.2], [61, 1.2], [71.5, 1.035]], [E.io, E.lin, E.in]);
    const dz = deriv(fz => kf(fz, [[46, 1], [60, 1.2], [61, 1.2], [71.5, 1.035]], [E.io, E.lin, E.in]), f);
    const y = headerY(f), vy = deriv(headerY, f);
    const wo = kf(f, [[14, 0], [15, 0.53], [19, 0.7], [24, 1]]);
    const wdy = f < 24 ? (y - 546) * 0.35 : y - 546;
    const wsc = kf(f, [[14, 1.035], [30, 1]], E.expo);
    let cur = '';
    if (f >= 27) {
      const [cx, cy] = cur1(f), v = [deriv(g => cur1(g)[0], f), deriv(g => cur1(g)[1], f)];
      const sc = SC1(f) * z;
      cur = cursor(cx, cy, ROT1(f), sc, clamp((f - 26.6) / 1.2), f < 27.6 ? -16 : v[0], f < 27.6 ? 2 : v[1]);
    }
    const scene = `<g transform="translate(540,540) scale(${n2(z * 1000) / 1000}) translate(-540,-540)">
${wo > 0 ? `<g opacity="${n2(wo)}">${hubWindow(f, wdy, wsc)}</g>` : ''}
${lockup(f, y, vy)}
</g>`;
    return `<rect width="1080" height="1080" fill="${bg}"/>
<ellipse cx="540" cy="1150" rx="900" ry="360" fill="${rgrad([[0, C.floor], [1, C.floor, 0]])}"/>
<g ${blur(Math.abs(dz) * 60)}>${scene}</g>${cur}`;
  },
};

// ======================================================================
// S2 f72–100  app icon + four squares orbiting into a cross
// ======================================================================
const SQ = [
  { c: '#FFFFFF', a: 180, row: [557, 507], white: true },
  { c: C.blue, a: 270, row: [612, 507] },
  { c: C.lblue, a: 360, row: [661, 507] },
  { c: C.green, a: 450, row: [709, 507] },
];
const icoSize = f => (f <= 86 ? kf(f, [[72, 276], [86, 178]], E.expo) : f <= 88 ? lerp(178, 174, (f - 86) / 2) : lerp(174, 40, E.in(clamp((f - 88) / 12))));
const icoC = f => { const t = E.in(clamp((f - 88) / 12)); return [lerp(540, 557, t), lerp(540, 507, t)]; };
function sqState(i, f) {
  const q = SQ[i];
  const off = kf(f, [[72, 250], [86, 0]], E.expo);
  const r = f <= 86 ? kf(f, [[72, 430], [86, 216]], E.expo) : lerp(216, 213, clamp((f - 86) / 2));
  const th = (q.a + off) * Math.PI / 180;
  const cross = [540 + r * Math.cos(th), 540 + r * Math.sin(th)];
  const t = E.in(clamp((f - 88) / 12));
  return { x: lerp(cross[0], q.row[0], t), y: lerp(cross[1], q.row[1], t), size: lerp(92, 36, t), rx: lerp(26, 18, t), rot: off * 0.6 };
}
function square(i, f) {
  const q = SQ[i], s = sqState(i, f);
  const vx = deriv(g => sqState(i, g).x, f), vy = deriv(g => sqState(i, g).y, f);
  const h = s.size / 2;
  const body = `<g transform="rotate(${n2(-s.rot)})"><rect x="${n2(-h)}" y="${n2(-h)}" width="${n2(s.size)}" height="${n2(s.size)}" rx="${n2(s.rx)}" fill="${q.c}" ${q.white ? 'stroke="#E3E8EF" stroke-width="1" filter="url(#faintShadow)"' : ''}/></g>`;
  return velBlur(body, s.x, s.y, vx, vy, 0.2, 20);
}
const S2 = {
  f0: 72, f1: 100,
  render(f) {
    const sz = icoSize(f), [cx, cy] = icoC(f);
    const halo = f < 75 ? kf(f, [[72, 206], [75, 240]]) : f <= 86 ? kf(f, [[75, 240], [86, 326]], E.expo) : sz * 326 / 178;
    const haloOp = 1 - clamp((f - 88) / 8);
    const g = kf(f, [[88, 0.3], [100, 6]], E.inq) * (f >= 88 ? 1 : 0);
    const vic = [deriv(h => icoC(h)[0], f), deriv(h => icoC(h)[1], f)];
    const icon = `<rect x="${n2(-sz / 2)}" y="${n2(-sz / 2)}" width="${n2(sz)}" height="${n2(sz)}" rx="${n2(sz * 0.28)}" fill="url(#gIcon)"/>${mark(0, sz * 0.02, sz * 0.68, 'white')}`;
    return `<rect width="1080" height="1080" fill="${C.page}"/>
<g ${blur(g)}>
${haloOp > 0 ? `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(halo / 2)}" fill="#E9E9E7" opacity="${n2(haloOp)}"/>` : ''}
${square(0, f)}
${velBlur(icon, cx, cy, vic[0], vic[1], 0.2, 12)}
${square(1, f)}${square(2, f)}${square(3, f)}
</g>`;
  },
};

// ======================================================================
// S3 f101–158  laptop menu bar, click, frosted glass prompt
// ======================================================================
function wallpaper() {
  return `<rect x="-400" y="538" width="1900" height="1200" fill="${grad([[0, C.deep], [0.75, C.sky], [1, C.sky]], 0, 538, 0, 1500, 'userSpaceOnUse')}"/>
<circle cx="1030" cy="600" r="330" fill="${rgrad([[0, '#5FD6E6', 0.55], [1, '#5FD6E6', 0]])}"/>
<g stroke="#FFFFFF" stroke-opacity=".5" stroke-width="2" fill="none">
<circle cx="300" cy="860" r="270"/>
<line x1="-400" y1="700" x2="1500" y2="700"/><line x1="-400" y1="1010" x2="1500" y2="1010"/>
<line x1="760" y1="538" x2="760" y2="1700"/></g>
<path d="M760,668 Q763,697 792,700 Q763,703 760,732 Q757,703 728,700 Q757,697 760,668 Z" fill="#FFFFFF" opacity=".9"/>`;
}
function menuBar(f) {
  const hi = kf(f, [[113.5, 0], [115, 0.26], [130, 0.18]]);
  return `<rect x="-400" y="-600" width="1900" height="1025" fill="${C.page}"/>
<rect x="-400" y="425" width="1900" height="52" fill="#0A0A0B"/>
<rect x="-400" y="425" width="1900" height="1.5" fill="#686866"/>
<rect x="-400" y="477" width="1900" height="61" fill="#12234B"/>
<g stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round">
<path d="M318,512 a24,24 0 0 1 34,0 M324,518 a15,15 0 0 1 22,0"/><circle cx="335" cy="524" r="2.6" fill="#fff"/>
<rect x="388" y="497" width="44" height="21" rx="6"/><line x1="436" y1="504" x2="436" y2="511"/>
<rect x="465" y="495" width="30" height="11" rx="5.5"/><rect x="465" y="510" width="30" height="11" rx="5.5"/></g>
<rect x="392" y="501" width="30" height="13" rx="3" fill="#fff"/>
<circle cx="489" cy="500.5" r="3.5" fill="#fff"/><circle cx="471" cy="515.5" r="3.5" fill="#fff"/>
${hi > 0 ? `<rect x="519" y="484" width="77" height="47" rx="12" fill="#fff" opacity="${n2(hi)}"/>` : ''}
${mark(557.5, 507, 53, 'white')}
<circle cx="612" cy="507" r="18" fill="${C.blue}"/><circle cx="661" cy="507" r="18" fill="${C.lblue}"/><circle cx="709" cy="507" r="18" fill="${C.green}"/>
${txt(748, 519, T.date, 500, 34, '#FFFFFF')}`;
}
// typing: 1 char/frame with a 1-frame hold every 3 chars
const TYPE = (() => {
  const a = {}; let n = 0;
  for (let fr = 117; fr <= 121; fr++) a[fr] = n = Math.min(6, (fr - 116) + (fr >= 120 ? 1 : 0));
  for (let k = 0; k < 29; k++) { if (!(k % 4 === 3 && k !== 27)) n++; a[122 + k] = Math.min(T.prompt.length, n); }
  return a;
})();
const typed = f => (f < 117 ? 0 : TYPE[Math.min(150, Math.floor(f))] ?? T.prompt.length);
const BW = mono([[116, 70], [119, 420], [122, 650], [126, 744], [130, 716], [134, 730], [138, 726]]);
const BH = mono([[116, 34], [120, 160], [124, 240], [128, 230], [132, 226], [138, 228]]);
const BCX = mono([[116, 557], [121, 470], [126, 438], [138, 434]]);
const BTY = mono([[116, 538], [121, 563], [126, 570], [138, 568]]);
const PAN = f => 125 * E.io(Math.pow(clamp((f - 115) / 15), 0.75));
const TILT = f => (f <= 136 ? 0 : -0.0172 * Math.pow(f - 136, 3));
const CUR3 = f => {
  if (f <= 118) return [expoTo(f, 101.5, 111, 650, 566, 0.8), expoTo(f, 101.5, 111, 1110, 516, 0.8)];
  const t = f - 118; return [566 + 0.9 * t * t, 516 + 0.7 * t * t];
};
function glassBox(f) {
  if (f < 116) return '';
  const w = BW(f), h = BH(f), x = BCX(f) - w / 2, y = BTY(f), rx = Math.min(60, h / 2);
  const op = clamp((f - 116) / 1.5);
  const shape = `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" rx="${n2(rx)}"/>`;
  const cop = clamp((f - 119) / 3);
  const n = typed(f), s = T.prompt.slice(0, n), fs = L.promptFs;
  const tx = x + 46, ty = y + 80;
  const caretX = tx + (n ? tw(s, 500, fs) : 0) + 3;
  const ic = y + h - 52;
  const content = cop > 0 ? `<g opacity="${n2(cop)}">
${txt(tx, ty, s, 500, fs, '#FFFFFF')}
<rect x="${n2(caretX)}" y="${n2(ty - fs * 0.86)}" width="3" height="${n2(fs * 1.1)}" rx="1.5" fill="#FFFFFF"/>
<g stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
<circle cx="${n2(x + 66)}" cy="${n2(ic)}" r="17"/><path d="M${n2(x + 66)},${n2(ic - 8)} v16 M${n2(x + 58)},${n2(ic)} h16"/>
<circle cx="${n2(x + 128)}" cy="${n2(ic)}" r="17"/><ellipse cx="${n2(x + 128)}" cy="${n2(ic)}" rx="7" ry="17"/><path d="M${n2(x + 111)},${n2(ic)} h34"/>
<rect x="${n2(x + 183)}" y="${n2(ic - 17)}" width="14" height="22" rx="7"/><path d="M${n2(x + 179)},${n2(ic + 1)} a11,11 0 0 0 22,0 M${n2(x + 190)},${n2(ic + 12)} v6"/></g>
<circle cx="${n2(x + w - 58)}" cy="${n2(ic)}" r="25.5" fill="${C.blue}"/>
<path d="M${n2(x + w - 58)},${n2(ic + 10)} v-20 M${n2(x + w - 67)},${n2(ic - 1)} l9,-9 l9,9" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</g>` : '';
  return `<g opacity="${n2(op)}">
<g ${blur(26)}><rect x="${n2(x + 10)}" y="${n2(y + 26)}" width="${n2(w - 20)}" height="${n2(h)}" rx="${n2(rx)}" fill="#071A44" opacity=".32"/></g>
<g ${clip(shape)}>
<g ${blur(22)}>${wallpaper()}</g>
<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" fill="${grad([[0, '#F2F8FF', 0.42], [0.5, '#DDEBFF', 0.26], [1, '#CFE3FF', 0.22]])}"/>
</g>
<rect x="${n2(x + 0.75)}" y="${n2(y + 0.75)}" width="${n2(w - 1.5)}" height="${n2(h - 1.5)}" rx="${n2(rx)}" fill="none" stroke="${grad([[0, '#FFFFFF', 0.95], [0.4, '#FFFFFF', 0.35], [1, '#FFFFFF', 0.18]])}" stroke-width="2"/>
${content}
</g>`;
}
const S3 = {
  f0: 101, f1: 158,
  render(f) {
    const k = kf(f, [[101, 1.16], [110, 1]], E.expo);
    const pan = PAN(f), tilt = TILT(f), vt = deriv(TILT, f), vp = deriv(PAN, f);
    const entry = kf(f, [[101, 3], [110, 0]], E.expo);
    const [cx, cy] = CUR3(f), cv = [deriv(g => CUR3(g)[0], f), deriv(g => CUR3(g)[1], f)];
    const press = kf(f, [[113, 1], [115, 0.85], [117, 1]]);
    const cop = clamp((f - 101.6) / 1) * (1 - clamp((f - 129) / 3));
    const tint = kf(f, [[154, 0], [158, 0.88]], E.inq);
    const content = `<g transform="translate(${n2(pan)},${n2(tilt)}) translate(557.5,507) scale(${n2(k * 1000) / 1000}) translate(-557.5,-507)">
${wallpaper()}${menuBar(f)}${glassBox(f)}
${cursor(cx, cy, 0, press, cop, cv[0] * k + vp, cv[1] * k)}
</g>`;
    return `<rect width="1080" height="1080" fill="${C.page}"/>
<g ${blur(entry + Math.abs(vp) * 0.06, entry + Math.abs(vt) * 0.28)}>${content}</g>
${tint > 0 ? `<rect width="1080" height="1080" fill="#E6F4FE" opacity="${n2(tint)}"/>` : ''}`;
  },
};

// ======================================================================
// S4 f159–186  answer page scrolling into place
// ======================================================================
const OFF4 = mono([[159, 420], [160, 315], [161, 210], [162, 170], [163, 140], [164, 116], [165, 96], [166, 81], [168, 57], [170, 40], [172, 27], [175, 14], [177, 7.5], [180, 0], [186, -6]]);
const off4 = f => (f <= 186 ? OFF4(f) : -6 - (f - 186));
function page4(dy) {
  const line = (ln, i) => ln.map(t => txt(t.x, L.body0 + i * 58, t.w, t.key ? 600 : 400, 47, t.key ? '#0E0F11' : '#BCBCBA')).join('');
  return `<g transform="translate(0,${n2(dy)})">
${txt(120, 300, T.crumb, 500, 26, '#A3A9B3')}
${txt(120, 398, T.title, 700, L.titleFs, '#0E0F11', 'letter-spacing="-1"')}
${L.lines.map(line).join('')}
${L.linesB.map((ln, i) => ln.map(t => txt(t.x, L.bodyB0 + i * 58, t.w, 400, 47, '#BCBCBA')).join('')).join('')}
<rect x="120" y="${n2(L.bodyB0 + L.linesB.length * 58 + 30)}" width="840" height="2" fill="#EEEEEC"/>
</g>`;
}
const CUR4 = f => {
  const dy = off4(f), extra = kf(f, [[159, 160], [180, 0]], E.expo);
  return [L.keyX - 6 + (f > 180 ? (f - 180) * 2.2 : 0), L.keyY + dy + extra];
};
const S4 = {
  f0: 159, f1: 186,
  render(f) {
    const dy = off4(f);
    const b = kf(f, [[159, 24], [160, 14], [161, 9], [162, 6], [163, 4], [164, 2.6], [165, 1.5], [168, 0.4], [170, 0]]);
    const flash = kf(f, [[159, 1], [165, 0]], E.out);
    const [cx, cy] = CUR4(f);
    const cv = [deriv(g => CUR4(g)[0], f), deriv(g => CUR4(g)[1], f)];
    return `<rect width="1080" height="1080" fill="${C.page}"/>
${flash > 0 ? `<rect width="1080" height="1080" fill="#E2F4FE" opacity="${n2(flash)}"/>` : ''}
<g ${blur(b * 0.12, b)}>${page4(dy)}</g>
${cursor(cx, cy, 21.6, 1.15, 1, cv[0], cv[1])}`;
  },
};

// ======================================================================
// S5 f187–214  card rises over the page
// ======================================================================
const CT5 = mono([[187, 642], [191, 456], [196, 395], [200, 369], [205, 348], [206, 344]]);
const ct5 = f => (f <= 206 ? CT5(f) : 344 - (f - 206) * 4 - (f > 207 ? 1.6 * Math.pow(f - 207, 2) : 0));
const S5 = {
  f0: 187, f1: 214,
  render(f) {
    const top = ct5(f), vy = deriv(ct5, f);
    const cb = kf(f, [[187, 3], [189, 3.8], [192, 2.6], [196, 1.1], [201, 0]]);
    const pb = kf(f, [[187, 0.3], [195, 2.5]], E.out);
    const sc = kf(f, [[207, 1], [214, 0.95]], E.in);
    const fb = kf(f, [[207, 1], [214, 7]], E.inq) * (f >= 207 ? 1 : 0);
    const cardTop = top - 46, cx = 540.5, cyc = top + 268;
    const card = `<g transform="translate(${cx},${n2(cyc)}) scale(${n2(sc)}) translate(${-cx},${n2(-cyc)})">
<rect x="203" y="${n2(cardTop)}" width="675" height="1100" rx="88" fill="#FFFFFF" filter="url(#softShadow)"/>
<rect x="504" y="${n2(cardTop + 15)}" width="72" height="9" rx="4.5" fill="#E2E5EA"/>
<g ${clip(`<rect x="227" y="${n2(top)}" width="627" height="536" rx="64"/>`)}>${artBox(227, top, 627, 536)}</g>
${txt(251, top + 536 + 62, T.cardCap, 600, 38, '#0E0F11')}
${txt(251, top + 536 + 100, T.cardSub, 500, 23, '#9AA0AA')}
</g>`;
    return `<g ${blur(fb)}>
<rect width="1080" height="1080" fill="${C.page}"/>
<g ${blur(pb)}>${page4(off4(f))}</g>
<rect width="1080" height="1080" fill="#0B2A66" opacity="${n2(kf(f, [[187, 0], [196, 0.05]]))}"/>
<g ${blur(cb * 0.25, cb + Math.abs(vy) * 0.03)}>${card}</g>
</g>`;
  },
};

// ======================================================================
// S6 f215–244  two stacked cards with frosted glass titles
// ======================================================================
function glassCard(x, y, art, title, pill) {
  const w = 538, h = 348, rx = 57;
  const cardClip = clip(`<rect x="${x}" y="${n2(y)}" width="${w}" height="${h}" rx="${rx}"/>`);
  const fs = L.cardFs, base = y + h + fs * 0.13;
  const titleT = `<text x="${x + 22}" y="${n2(base)}" font-weight="700" font-size="${n2(fs)}" letter-spacing="-3">${esc(title)}</text>`;
  const pw = tw(pill, 600, 21) + 36;
  const frost = shape => `<g ${clip(shape)}><g ${blur(16)}>${art(x, y, w, h)}</g><rect x="${x}" y="${n2(y)}" width="${w}" height="${h}" fill="#FFFFFF" opacity=".32"/></g>`;
  const pillShape = `<rect x="${x + 24}" y="${n2(y + 24)}" width="${n2(pw)}" height="44" rx="22"/>`;
  const dotShape = `<circle cx="${x + w - 46}" cy="${n2(y + 46)}" r="22"/>`;
  return `<g filter="url(#softShadow)"><rect x="${x}" y="${n2(y)}" width="${w}" height="${h}" rx="${rx}" fill="#fff"/></g>
<g ${cardClip}>
${art(x, y, w, h)}
<rect x="${x}" y="${n2(y + h * 0.45)}" width="${w}" height="${h * 0.55}" fill="${grad([[0, '#07183D', 0], [1, '#07183D', 0.48]])}"/>
<g ${clip(titleT)}><g ${blur(14)}>${art(x, y, w, h)}</g><rect x="${x}" y="${n2(y)}" width="${w}" height="${h}" fill="#FFFFFF" opacity=".6"/></g>
<text x="${x + 22}" y="${n2(base)}" font-weight="700" font-size="${n2(fs)}" letter-spacing="-3" fill="none" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="1.4">${esc(title)}</text>
${frost(pillShape)}<rect x="${x + 24.5}" y="${n2(y + 24.5)}" width="${n2(pw - 1)}" height="43" rx="21.5" fill="none" stroke="#fff" stroke-opacity=".5"/>
${txt(x + 42, y + 53, pill, 600, 21, '#FFFFFF')}
${frost(dotShape)}<circle cx="${x + w - 46}" cy="${n2(y + 46)}" r="21.5" fill="none" stroke="#fff" stroke-opacity=".5"/>
<circle cx="${x + w - 56}" cy="${n2(y + 46)}" r="3.2" fill="#fff"/><circle cx="${x + w - 46}" cy="${n2(y + 46)}" r="3.2" fill="#fff"/><circle cx="${x + w - 36}" cy="${n2(y + 46)}" r="3.2" fill="#fff"/>
</g>`;
}
const exit6 = f => (f <= 230 ? 0 : -(f - 230) * 3 - (f > 238 ? 2.2 * Math.pow(f - 238, 2.4) : 0));
const TOPY = f => kf(f, [[215, 264], [230, 168]], E.expo) + exit6(f);
const BOTY = f => kf(f, [[215, 927], [217, 905], [233, 552]], [E.lin, E.expo]) + exit6(f);
const S6 = {
  f0: 215, f1: 244,
  render(f) {
    const ty = TOPY(f), by = BOTY(f);
    const s1 = kf(f, [[215, 1.08], [226, 1]], E.expo);
    const b1 = kf(f, [[215, 12], [224, 0]], E.expo), b2 = kf(f, [[215, 12], [227, 0]], E.expo);
    const out = kf(f, [[238, 0], [244, 9]], E.inq) * (f >= 238 ? 1 : 0);
    const v1 = deriv(TOPY, f), v2 = deriv(BOTY, f);
    const top = `<g transform="translate(540,${n2(ty + 174)}) scale(${n2(s1)}) translate(-540,${n2(-(ty + 174))})">${glassCard(271, ty, artImmun, T.c1, T.c1pill)}</g>`;
    return `<rect width="1080" height="1080" fill="${C.page}"/>
<g ${blur(b2 + out * 0.2, b2 + Math.abs(v2) * 0.06 + out)}>${glassCard(271, by, artEnergy, T.c2, T.c2pill)}</g>
<g ${blur(b1 + out * 0.2, b1 + Math.abs(v1) * 0.06 + out)}>${top}</g>`;
  },
};

// ======================================================================
// S7 f245–300  product hero: the Vitaten box (held still f269–287)
// ======================================================================
const DT7 = mono([[245, 569], [250, 491], [255, 468], [262, 459], [269, 456]]);
const S7 = {
  f0: 245, f1: 300,
  render(f) {
    const d = f <= 287 ? 168 : lerp(168, 123, E.in(clamp((f - 287) / 13)));
    const cy = DT7(f) + 84, vy = deriv(DT7, f);
    const smear = f < 246 ? 9 : 0;
    const hero = `<g transform="scale(${n2(d / 168)})"><circle r="300" fill="${rgrad([[0, '#E3EFFB'], [0.7, '#EDF4FB'], [1, '#F7FAFD']])}" stroke="#E8EEF5"/>${box(0, 318, 636)}</g>`;
    return `<rect width="1080" height="1080" fill="${C.page}"/>
<ellipse cx="540" cy="1150" rx="900" ry="360" fill="${rgrad([[0, C.floor], [1, C.floor, 0]])}"/>
${dirBlur(hero, 540, cy, 90, Math.min(22, Math.abs(vy) * 0.22) + smear)}`;
  },
};

// ======================================================================
// S8 f301–359  black end card, glowing wordmark + site
// ======================================================================
const WW = mono([[301, 1650], [302, 1350], [303, 1110], [304, 1049], [306, 905], [309, 734], [311, 678], [315, 610], [320, 563], [330, 535], [342, 516], [350, 492], [353, 474], [355, 450], [357, 380], [359, 267]]);
const S8 = {
  f0: 301, f1: 359,
  render(f) {
    const w = WW(f), dw = deriv(WW, f), fs = w / L.word100 * 100;
    const by = 540 + fs * 0.36;
    const end = kf(f, [[354, 0], [359, 3.5]], E.inq);
    const word = (s, op, extra = '') => `<text x="540" y="${n2(by)}" text-anchor="middle" font-weight="600" font-size="${n2(fs * s)}" fill="#F3F3F5" opacity="${n2(op)}" ${extra} transform="translate(540,540) scale(1) translate(-540,-540)">${esc(T.name)}</text>`;
    // zoom streaks while the word is still racing in
    const streakAmt = clamp(Math.abs(dw) / w * 3.2, 0, 1);
    let streaks = '';
    if (streakAmt > 0.02) {
      for (let i = 1; i <= 24; i++) {
        const k = 1 + i * 0.018 * streakAmt * 2.4;
        streaks += `<g transform="translate(540,540) scale(${n2(k * 1000) / 1000}) translate(-540,-540)">${word(1, 0.22 * streakAmt * Math.pow(1 - i / 25, 1.4))}</g>`;
      }
    }
    const glowId = uid('gl');
    DEFS.push(`<filter id="${glowId}" filterUnits="userSpaceOnUse" x="-600" y="-200" width="2280" height="1480"><feGaussianBlur in="SourceGraphic" stdDeviation="${n2(fs * 0.05)}" result="a"/><feGaussianBlur in="SourceGraphic" stdDeviation="${n2(fs * 0.4)}" result="b"/><feComponentTransfer in="b" result="b2"><feFuncA type="linear" slope=".55"/></feComponentTransfer><feComponentTransfer in="a" result="a2"><feFuncA type="linear" slope=".75"/></feComponentTransfer><feMerge><feMergeNode in="b2"/><feMergeNode in="a2"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
    const siteOp = clamp((f - 314) / 10), siteRise = kf(f, [[314, 16], [328, 0]], E.expo);
    const sfs = fs * 0.2;
    const site = siteOp > 0 ? `<g opacity="${n2(siteOp)}" ${blur(kf(f, [[314, 4], [324, 0]], E.expo))}><text x="540" y="${n2(540 + fs * 0.84 + siteRise)}" text-anchor="middle" font-weight="500" font-size="${n2(fs * 0.22)}" fill="#D6D6DC">${esc(T.tagline)}</text><text x="540" y="${n2(540 + fs * 1.3 + siteRise * 1.4)}" text-anchor="middle" font-weight="500" font-size="${n2(sfs)}" letter-spacing="${n2(sfs * 0.06)}" fill="#A6A6AE">${esc(T.site)}</text></g>` : '';
    return `<rect width="1080" height="1080" fill="${rgrad([[0, '#2A2A2C'], [0.45, '#111113'], [1, '#020204']], 540, 540, 765, 540, 540, 'userSpaceOnUse')}"/>
<g ${blur(Math.min(26, Math.abs(dw) * 0.035) + end, end)}>
${streaks}
<g filter="url(#${glowId})">${word(1, 1)}</g>
${site}
</g>`;
  },
};

// ---------- driver ----------
const SHOTS = [S1, S2, S3, S4, S5, S6, S7, S8];
const stage = document.getElementById('stage');
window.seek = function (f) {
  DEFS = []; FID = 0;
  const shot = SHOTS.find(s => f >= s.f0 && f < s.f1 + 1) || S8;
  const body = shot.render(f);
  stage.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080"><defs>${STATIC}${DEFS.join('')}</defs>${body}</svg>`;
};
window.ready = (async () => {
  await Promise.all([400, 500, 600, 700].map(w => document.fonts.load(`${w} 40px IN`, 'Витатен aksonmegavit')));
  await document.fonts.ready;
  await new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = 'box.png'; });
  layout();
  const q = new URLSearchParams(location.search).get('f');
  window.seek(q ? parseFloat(q) : 40);
  return true;
})();

// Brush primitives for the footer painting. Every stroke is a filled outline traced
// around a centreline, so its width can swell and taper like a loaded brush.

export const round = (n) => Math.round(n * 10) / 10;
const point = ([x, y]) => `${round(x)} ${round(y)}`;

// Park–Miller generator: each layer of the painting gets its own seed so tuning one
// never reshuffles the grain of another.
export const createRng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// Sample a path made of absolute M/L/Q commands into a dense polyline.
export function sample(d, step = 0.004) {
  const tokens = d.match(/[MLQ]|-?\d*\.?\d+/g);
  const points = [];
  let i = 0;
  let current = [0, 0];
  let command;
  while (i < tokens.length) {
    if (/[MLQ]/.test(tokens[i])) command = tokens[i++];
    const next = () => Number(tokens[i++]);
    if (command === "M" || command === "L") {
      const p = [next(), next()];
      if (command === "L") {
        for (let t = step; t <= 1; t += step) {
          points.push([current[0] + (p[0] - current[0]) * t, current[1] + (p[1] - current[1]) * t]);
        }
      } else points.push(p);
      current = p;
    } else {
      const c = [next(), next()];
      const p = [next(), next()];
      for (let t = step; t <= 1.0001; t += step) {
        const a = (1 - t) ** 2;
        const b = 2 * (1 - t) * t;
        const e = t * t;
        points.push([a * current[0] + b * c[0] + e * p[0], a * current[1] + b * c[1] + e * p[1]]);
      }
      current = p;
    }
  }
  return points;
}

// Points on a silhouette between x0 and x1 (walked in that order), pushed `inset` units
// inward, i.e. down into the form.
export function along(silhouette, x0, x1, inset) {
  const [lo, hi] = x0 < x1 ? [x0, x1] : [x1, x0];
  let points = silhouette.filter(([x]) => x >= lo && x <= hi);
  if (points.length < 2) {
    const k = silhouette.reduce(
      (best, p, j) => (Math.abs(p[0] - x0) < Math.abs(silhouette[best][0] - x0) ? j : best),
      0,
    );
    points = [silhouette[k], silhouette[Math.min(silhouette.length - 1, k + 1)]];
  }
  if (x0 > x1) points = points.reverse();
  return points.map((p, k) => {
    const a = points[Math.max(0, k - 1)];
    const b = points[Math.min(points.length - 1, k + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    let nx = -ty;
    let ny = tx;
    if (ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    return [p[0] + nx * inset, p[1] + ny * inset];
  });
}

export const quad = (s, c, e, n = 24) =>
  Array.from({ length: n + 1 }, (_unused, k) => {
    const t = k / n;
    const a = (1 - t) ** 2;
    const b = 2 * (1 - t) * t;
    const f = t * t;
    return [a * s[0] + b * c[0] + f * e[0], a * s[1] + b * c[1] + f * e[1]];
  });

// Outline a centreline with a brush profile: a quick press over `press` of the length,
// then a long lift down to `tail`. `grain` roughens the edge like a drying brush.
export function brush(rand, line, maxWidth, { press = 0.18, grain = 0.18, tail = 0.12 } = {}) {
  if (line.length > 40) {
    const n = Math.ceil(line.length / 32);
    line = line.filter((_unused, k) => k % n === 0 || k === line.length - 1);
  }
  const left = [];
  const right = [];
  line.forEach((p, k) => {
    const s = k / (line.length - 1);
    const a = line[Math.max(0, k - 1)];
    const b = line[Math.min(line.length - 1, k + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const body = s < press ? Math.sin(((s / press) * Math.PI) / 2) : (1 - (s - press) / (1 - press)) ** 0.9;
    const w = (maxWidth / 2) * Math.max(tail, body) * (1 - grain / 2 + rand() * grain);
    left.push([p[0] - ty * w, p[1] + tx * w]);
    right.push([p[0] + ty * w, p[1] - tx * w]);
  });
  return "M" + [...left, ...right.reverse()].map(point).join(" L") + " Z";
}

// A brush touch laid flat on the water: tapered at both ends, slightly bowed.
export const lens = (x, y, len, w, bend = -0.6) =>
  `M${round(x)} ${round(y)} Q${round(x + len * 0.42)} ${round(y - w + bend)} ${round(x + len)} ${round(y + bend * 0.3)} ` +
  `Q${round(x + len * 0.55)} ${round(y + w * 0.7 + bend)} ${round(x)} ${round(y)} Z`;

export { point };

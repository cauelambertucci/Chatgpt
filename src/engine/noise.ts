import { hash } from "./rng";
// Smooth interpolated value noise, layered in octaves.
export function noise(x: number, y: number, seed: string) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const smooth = (v: number) => v * v * (3 - 2 * v);
  const u = smooth(x - ix),
    v = smooth(y - iy);
  const n = (a: number, b: number) => hash(`${seed}:${a}:${b}`) / 4294967295;
  return (
    (n(ix, iy) * (1 - u) + n(ix + 1, iy) * u) * (1 - v) +
    (n(ix, iy + 1) * (1 - u) + n(ix + 1, iy + 1) * u) * v
  );
}
export function fbm(x: number, y: number, seed: string) {
  let value = 0,
    amplitude = 1,
    total = 0;
  for (let i = 0; i < 5; i++) {
    value += noise(x, y, seed + i) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    x *= 2;
    y *= 2;
  }
  return value / total;
}

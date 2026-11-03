import type { World } from "../types";
import { colors, biomes } from "../data/catalog";
export type Layer = "biomes" | "elevation" | "temperature" | "political";
export function mountMap(
  canvas: HTMLCanvasElement,
  w: World,
  onSelect: (id: string) => void,
  onHover: (text: string) => void,
) {
  const ctx = canvas.getContext("2d")!;
  let width = 800,
    height = 500,
    zoom = 1,
    panX = 0,
    panY = 0,
    layer: Layer = "biomes",
    markers = true,
    drag = false,
    moved = false,
    lastX = 0,
    lastY = 0;
  const { size, tiles } = w.geography;
  const texture = document.createElement("canvas");
  texture.width = size;
  texture.height = size;
  const tc = texture.getContext("2d")!;
  function paint() {
    tiles.forEach((t, i) => {
      let color = colors[t.biome];
      if (t.water && t.biome !== 0) color = "#3b7480";
      if (layer === "elevation") {
        const v = Math.floor(Math.max(0, t.elevation) * 230);
        color = `rgb(${v},${v + 8},${v})`;
      }
      if (layer === "temperature") {
        const v = t.temperature;
        color = `rgb(${Math.floor(75 + v * 140)},${Math.floor(155 - v * 50)},${Math.floor(185 - v * 105)})`;
      }
      if (layer === "political" && !t.water)
        color = w.civs.find((c) => c.id === t.owner)?.color || color;
      tc.fillStyle = color;
      tc.fillRect(i % size, Math.floor(i / size), 1, 1);
    });
    for (let i = 0; i < tiles.length; i++)
      if (tiles[i].river) {
        tc.fillStyle = "#6eafb4";
        tc.fillRect(i % size, Math.floor(i / size), 1, 1);
      }
    draw();
  }
  function metrics() {
    const unit = Math.min(width / size, height / size) * 0.89 * zoom;
    return {
      unit,
      ox: (width - size * unit) / 2 + panX,
      oy: (height - size * unit) / 2 + panY,
    };
  }
  function draw() {
    const dpr = devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#19333b";
    ctx.fillRect(0, 0, width, height);
    const { unit, ox, oy } = metrics();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(texture, ox, oy, size * unit, size * unit);
    ctx.strokeStyle = "#ffffff09";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(ox + (i * size * unit) / 8, oy);
      ctx.lineTo(ox + (i * size * unit) / 8, oy + size * unit);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ox, oy + (i * size * unit) / 8);
      ctx.lineTo(ox + size * unit, oy + (i * size * unit) / 8);
      ctx.stroke();
    }
    if (markers) {
      for (const s of w.settlements) {
        const x = ox + ((s.tile % size) + 0.5) * unit,
          y = oy + (Math.floor(s.tile / size) + 0.5) * unit,
          capital = w.civs.some((c) => c.capital === s.id);
        ctx.fillStyle = w.civs.find((c) => c.id === s.civ)!.color;
        ctx.strokeStyle = "#132a2b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, capital ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (capital || zoom > 1.6) {
          ctx.font = `${capital ? 12 : 10}px Georgia`;
          ctx.textAlign = "center";
          ctx.strokeStyle = "#142a2b";
          ctx.lineWidth = 3;
          ctx.strokeText(s.name, x, y - 10);
          ctx.fillStyle = "#f2e6cb";
          ctx.fillText(s.name, x, y - 10);
        }
      }
      for (const e of w.events
        .filter((e) =>
          ["batalha", "cerco", "desastre", "caçada"].includes(e.type),
        )
        .slice(-6)) {
        const s = w.settlements.find((s) => s.id === e.location);
        if (s) {
          const x = ox + ((s.tile % size) + 0.5) * unit,
            y = oy + (Math.floor(s.tile / size) + 0.5) * unit;
          ctx.strokeStyle = "#e7c89299";
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      for (const m of w.creatures.filter((m) => m.slain === undefined)) {
        const x = ox + ((m.tile % size) + 0.5) * unit,
          y = oy + (Math.floor(m.tile / size) + 0.5) * unit;
        ctx.fillStyle = "#e1a78b";
        ctx.font = "14px serif";
        ctx.fillText("♧", x, y);
      }
    }
    ctx.strokeStyle = "#d5c6a22a";
    ctx.strokeRect(ox, oy, size * unit, size * unit);
  }
  function hit(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect(),
      { unit, ox, oy } = metrics();
    const x = Math.floor((e.clientX - rect.left - ox) / unit),
      y = Math.floor((e.clientY - rect.top - oy) / unit);
    return { x, y, i: y * size + x };
  }
  canvas.onpointerdown = (e) => {
    drag = true;
    moved = false;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove = (e) => {
    if (drag) {
      const dx = e.clientX - lastX,
        dy = e.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 1) moved = true;
      panX += dx;
      panY += dy;
      lastX = e.clientX;
      lastY = e.clientY;
      draw();
    }
    const { x, y, i } = hit(e);
    if (x >= 0 && y >= 0 && x < size && y < size) {
      const t = tiles[i];
      onHover(
        `${x}, ${y} · ${t.water && t.biome !== 0 ? "lago" : biomes[t.biome]} · ${w.geography.regions.find((r) => r.id === t.region)?.name}`,
      );
    }
  };
  canvas.onpointerup = (e) => {
    drag = false;
    if (moved) return;
    const { x, y, i } = hit(e);
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const { unit } = metrics();
    const near = [
      ...w.settlements,
      ...w.creatures,
      ...w.geography.regions.slice(16),
    ].find(
      (s) =>
        Math.hypot((s.tile % size) - x, Math.floor(s.tile / size) - y) <
        Math.max(2, 8 / unit),
    );
    onSelect(near?.id || tiles[i].region);
  };
  canvas.onpointercancel = () => {
    drag = false;
  };
  canvas.onwheel = (e) => {
    e.preventDefault();
    zoom = Math.max(0.6, Math.min(7, zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
    draw();
  };
  const observer = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width * (devicePixelRatio || 1);
    canvas.height = height * (devicePixelRatio || 1);
    draw();
  });
  observer.observe(canvas);
  paint();
  return {
    layer: (value: Layer) => {
      layer = value;
      paint();
    },
    zoom: (direction: number) => {
      zoom = Math.max(0.6, Math.min(7, zoom * direction));
      draw();
    },
    reset: () => {
      zoom = 1;
      panX = panY = 0;
      draw();
    },
    markers: (show: boolean) => {
      markers = show;
      draw();
    },
    destroy: () => observer.disconnect(),
  };
}

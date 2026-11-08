import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { gzipSync } from "node:zlib";
import { SliceSimulation } from "../src/engine/v2/engine";
import { livelihoodScenario } from "../src/engine/v2/daily-scenario";
import { CompactLog, replayCompact } from "../src/engine/v2/compact-log";
import { validateCompact } from "../src/engine/v2/validate";
import { Archive } from "../src/ui/v2/model";
const seed = "reservado-2b-006",
  s = livelihoodScenario(seed, 40);
const reuse = process.argv.includes("--reuse");
const warm = structuredClone(s);
warm.months = 12;
if (!reuse) new SliceSimulation(warm).advance();
(globalThis as any).gc?.();
const start = performance.now(),
  sim = new SliceSimulation(s);
if (!reuse) sim.advance();
const coreMs = performance.now() - start,
  coreRSS = process.resourceUsage().maxRSS * 1024,
  coreHeap = process.memoryUsage().heapUsed;
const w = reuse
    ? JSON.parse(readFileSync(`reports/marco2d2/${seed}.world.json`, "utf8"))
    : sim.runCompact(),
  json = JSON.stringify(w);
mkdirSync("reports/marco2d2", { recursive: true });
writeFileSync(`reports/marco2d2/${seed}.world.json`, json);
const result = {
  seed,
  founders: 40,
  years: 100,
  coreMs,
  coreRSS,
  coreHeap,
  jsonBytes: Buffer.byteLength(json),
  gzipBytes: gzipSync(json).length,
  events: w.log.rows.length,
  errors: validateCompact(w),
  replayEqual: JSON.stringify(replayCompact(w)) === JSON.stringify(w.entities),
};
if (!reuse)
  writeFileSync("docs/MARCO2D2-CHECKS.json", JSON.stringify(result, null, 2));
console.log(
  reuse
    ? { reused: true, errors: result.errors, replayEqual: result.replayEqual }
    : result,
);
if (result.errors.length || !result.replayEqual) process.exitCode = 1;
const a = new Archive(w);
const selected = ["person:17", "person:01"]
  .map((id) => ({ id }))
  .map((p) => ({
    id: p.id,
    name: a.name(p.id),
    seed,
    paragraphs: a.paragraphs(p.id),
  }));
writeFileSync(
  "docs/MARCO2D2-BIOGRAFIAS.json",
  JSON.stringify(selected, null, 2),
);
let md =
  "# Duas biografias — 2d-2\n\nUma seed de exemplo já usada: `reservado-2b-006`, perfil Leve. Alda e Mael, para acompanhar cuidado e consequências familiares na mesma linhagem, sem substituir a seed. Fontes completas no JSON e no botão Por quê?.\n";
for (const p of selected) {
  md += `\n## ${p.name}\n`;
  for (const q of p.paragraphs)
    md += `\n${q.phase ? `### ${q.phase}\n\n` : ""}${q.text}\n`;
}
writeFileSync("docs/MARCO2D2-BIOGRAFIAS.md", md);
console.log(
  selected.map((p) => ({
    id: p.id,
    name: p.name,
    words: p.paragraphs
      .map((q) => q.text)
      .join(" ")
      .split(" ").length,
  })),
);

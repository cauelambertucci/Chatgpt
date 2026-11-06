import { build } from "esbuild";
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  mkdirSync,
  cpSync,
  readdirSync,
} from "node:fs";
import { gunzipSync } from "node:zlib";
import { tmpdir, cpus } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
const root = resolve("."),
  scratch = mkdtempSync(join(tmpdir(), "chronicle-memory-")),
  out = join(root, "reports/memory");
mkdirSync(out, { recursive: true });
const before = JSON.parse(
  gunzipSync(
    readFileSync("docs/reference-baselines/pre-memory-1d-source.json.gz"),
  ),
);
for (const mode of ["before", "after"]) {
  const dir = join(scratch, mode);
  mkdirSync(dir, { recursive: true });
  if (mode === "before")
    for (const [file, text] of Object.entries(before)) {
      mkdirSync(join(dir, file, ".."), { recursive: true });
      writeFileSync(join(dir, file), text);
    }
  else cpSync("src", join(dir, "src"), { recursive: true });
  for (const [name, file] of [
    ["runner.ts", "scripts/benchmark-memory-runner.ts"],
    ["scenario.ts", "scripts/memory-scenario.ts"],
  ])
    writeFileSync(join(dir, name), readFileSync(file));
  writeFileSync(
    join(dir, "adapter.ts"),
    mode === "before"
      ? "export const output=(sim:any)=>sim.run(); export const eventStream=(w:any)=>w.events;"
      : "import {CompactLog} from './src/engine/v2/compact-log'; export const output=(sim:any)=>sim.runCompact(); export const eventStream=(w:any)=>CompactLog.from(w.log).view(true);",
  );
  const engine = join(dir, "src/engine/v2/engine.ts"),
    rules = join(dir, "src/engine/v2/rules.ts");
  writeFileSync(
    engine,
    readFileSync(engine, "utf8").replace(
      "scenario.months > 240",
      "scenario.months > 1200",
    ),
  );
  writeFileSync(
    rules,
    readFileSync(rules, "utf8").replace(
      "maxEvents: 100000",
      "maxEvents: 1000000",
    ),
  );
  await build({
    entryPoints: [join(dir, "runner.ts")],
    outfile: join(dir, "runner.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    keepNames: true,
  });
}
const reused = process.argv.includes("--reuse-before")
  ? JSON.parse(
      readFileSync("docs/MEMORY-STRING-EAGER-ATTEMPT.json", "utf8"),
    ).filter((r) => r.mode === "before")
  : [];
if (reused.length && reused.length !== 3) throw Error("Incomplete baseline");
const rows = [...reused];
for (const mode of reused.length ? ["after"] : ["before", "after"])
  for (let i = 0; i < 3; i++) {
    console.log(mode, i + 1);
    const row = await new Promise((res, rej) => {
      const child = spawn(
        process.execPath,
        [
          "--expose-gc",
          "--max-old-space-size=8192",
          join(scratch, mode, "runner.mjs"),
          "warm",
        ],
        { stdio: ["ignore", "pipe", "inherit"] },
      );
      let text = "";
      child.stdout.on("data", (s) => (text += s));
      child.on("error", rej);
      child.on("close", (code) =>
        code ? rej(Error(`${mode}: ${code}`)) : res(JSON.parse(text)),
      );
    });
    rows.push({ mode, repetition: i + 1, ...row });
    console.log(
      JSON.stringify({
        mode,
        coreMs: row.coreMs,
        apiMs: row.apiTotalMs,
        bytes: row.jsonBytes,
        coreRssKiB: row.corePeakRssKiB,
        exportRssKiB: row.exportPeakRssKiB,
        events: row.events,
        eventHash: row.eventHash,
      }),
    );
    writeFileSync(
      join(out, "node-partial.json"),
      JSON.stringify(rows, null, 2),
    );
  }
if (
  new Set(rows.map((r) => r.eventHash)).size !== 1 ||
  new Set(rows.map((r) => r.entitiesHash)).size !== 1 ||
  new Set(rows.map((r) => r.scenarioHash)).size !== 1
)
  throw Error("Semantic equivalence failed");
writeFileSync(
  "docs/MEMORY-BENCHMARK.json",
  JSON.stringify(
    {
      scratch,
      reusedBaseline: reused.length > 0,
      node: process.version,
      cpu: cpus()[0]?.model,
      rows,
      equivalent: true,
    },
    null,
    2,
  ),
);
console.log("All six runs exactly equivalent after canonicalization.");

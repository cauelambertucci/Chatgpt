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
  scratch = mkdtempSync(join(tmpdir(), "chronicle-marco2b-")),
  out = join(root, "reports/marco2b-benchmark");
mkdirSync(out, { recursive: true });
const before = JSON.parse(
  gunzipSync(readFileSync("docs/reference-baselines/pre-2b-source.json.gz")),
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
    ["runner.ts", "scripts/benchmark-marco2b-runner.ts"],
    ["scenario.ts", "scripts/memory-scenario.ts"],
  ])
    writeFileSync(
      join(dir, name),
      name === "scenario.ts"
        ? readFileSync(file, "utf8").replace(
            "return s;",
            mode === "after" ? "s.bodySimulation={care:true,maxExchanges:6};s.lifeSimulation={};return s;" : "s.bodySimulation={care:true,maxExchanges:6};return s;",
          )
        : readFileSync(file),
    );
  writeFileSync(
    join(dir, "adapter.ts"),
    mode === "before"
      ? "import {CompactLog} from './src/engine/v2/compact-log'; export const output=(sim:any)=>sim.runCompact(); export const eventStream=(w:any)=>CompactLog.from(w.log).view(true);"
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
const reused = process.argv.includes("--reuse-session-baseline")
  ? JSON.parse(readFileSync(join(out, "baseline-session.json"), "utf8"))
  : [];
if (
  reused.length &&
  (reused.length !== 3 || reused.some((r) => r.mode !== "before"))
)
  throw Error("Invalid baseline");
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
for (const mode of ["before", "after"])
  if (
    new Set(rows.filter((r) => r.mode === mode).map((r) => r.eventHash))
      .size !== 1
  )
    throw Error("Repeatability failed");
if (new Set(rows.map((r) => r.baseScenarioHash)).size !== 1)
  throw Error("Base population differs");
writeFileSync(
  "docs/MARCO2B-BENCHMARK.json",
  JSON.stringify(
    {
      scratch,
      reusedBaseline: reused.length > 0,
      node: process.version,
      cpu: cpus()[0]?.model,
      rows,
      repeatable: true,
    },
    null,
    2,
  ),
);
console.log(
  "Both models repeatable; base seed/population identical. Body outcomes may differ.",
);

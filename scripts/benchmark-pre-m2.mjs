/** Measurement only. Production sources are never patched. */
import { build } from "esbuild";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { tmpdir, cpus, totalmem, platform, release } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "reports/benchmark-pre-m2");
mkdirSync(out, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), "chronicle-bench-"));
const digest = (s) => createHash("sha256").update(s).digest("hex");
const files = (folder) =>
  readdirSync(folder, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(folder, e.name)) : [join(folder, e.name)],
  );
const sourceFiles = [
  ...files(join(root, "src/engine/v2")),
  ...files(join(root, "src/data/v2")),
  join(root, "src/engine/rng.ts"),
].sort();
const sourceHashes = Object.fromEntries(
  sourceFiles.map((p) => [p.slice(root.length + 1), digest(readFileSync(p))]),
);
cpSync(join(root, "src/engine/v2"), join(scratch, "src/engine/v2"), {
  recursive: true,
});
cpSync(join(root, "src/data/v2"), join(scratch, "src/data/v2"), {
  recursive: true,
});
cpSync(join(root, "src/engine/rng.ts"), join(scratch, "src/engine/rng.ts"));
const engine = join(scratch, "src/engine/v2/engine.ts"),
  rules = join(scratch, "src/engine/v2/rules.ts");
const runner = readFileSync(
  join(root, "scripts/benchmark-pre-m2-runner.ts"),
  "utf8",
);
writeFileSync(join(scratch, "runner.ts"), runner);
await build({
  entryPoints: [join(scratch, "runner.ts")],
  outfile: join(scratch, "native.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: "external",
  keepNames: true,
});
const run = async (label, flags = []) =>
  new Promise((resolveRun, reject) => {
    console.log("Running", label);
    const child = spawn(
      process.execPath,
      [
        "--expose-gc",
        "--max-old-space-size=8192",
        join(scratch, label === "native" ? "native.mjs" : "extended.mjs"),
        ...flags,
      ],
      { cwd: root, stdio: ["ignore", "pipe", "inherit"] },
    );
    let output = "";
    child.stdout.on("data", (s) => (output += s));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(Error(`${label} exit ${code}`));
      try {
        const value = JSON.parse(output);
        writeFileSync(
          join(out, `${label}.json`),
          JSON.stringify(value, null, 2),
        );
        console.log(label, JSON.stringify(value));
        resolveRun(value);
      } catch (e) {
        reject(e);
      }
    });
  });
const native = await run("native", ["native"]);
const originalEngine = readFileSync(engine, "utf8"),
  originalRules = readFileSync(rules, "utf8");
if (
  !originalEngine.includes("scenario.months > 240") ||
  !originalRules.includes("maxEvents: 100000")
)
  throw Error("Guards changed; review harness");
writeFileSync(
  engine,
  originalEngine
    .replace("scenario.months > 240", "scenario.months > 1200")
    .replace(
      "Horizon must be 1–240 months",
      "Benchmark-only horizon 1–1200 months",
    ),
);
writeFileSync(
  rules,
  originalRules.replace("maxEvents: 100000", "maxEvents: 1000000"),
);
await build({
  entryPoints: [join(scratch, "runner.ts")],
  outfile: join(scratch, "extended.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: "external",
  keepNames: true,
});
const rows = [];
for (const [label, args] of [
  ["cold", []],
  ["warm-1", ["warm"]],
  ["warm-2", ["warm"]],
  ["warm-3", ["warm"]],
  ["profile", ["warm", "profile", join(out, "core.cpuprofile")]],
])
  rows.push({ label, ...(await run(label, args)) });
const unchanged = sourceFiles.every(
  (p) => digest(readFileSync(p)) === sourceHashes[p.slice(root.length + 1)],
);
const metadata = {
  node: process.version,
  platform: platform(),
  release: release(),
  cpu: cpus()[0]?.model,
  logicalCpus: cpus().length,
  totalMemoryBytes: totalmem(),
  sourceHashes,
  scratch,
  productionSourcesUnchanged: unchanged,
  guardChangesOnly: [
    "horizon 240 -> 1200 months",
    "maxEvents 100000 -> 1000000",
  ],
  native,
  rows,
};
writeFileSync(
  join(root, "docs/PRE-M2-BENCHMARK.json"),
  JSON.stringify(metadata, null, 2),
);
if (!unchanged) throw Error("Production source modified during benchmark");
console.log("Complete; production sources unchanged.");

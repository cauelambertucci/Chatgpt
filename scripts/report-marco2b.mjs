import { build } from "esbuild";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
mkdirSync("reports/marco2b", { recursive: true });
await build({
  entryPoints: ["scripts/report-marco2b-worker.ts"],
  outfile: "reports/marco2b/worker.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
});
const ranges = [
  [0, 50],
  [50, 100],
  [100, 150],
  [150, 200],
];
await Promise.all(
  ranges.map(
    ([a, b]) =>
      new Promise((resolve, reject) => {
        const p = spawn(
          process.execPath,
          [
            "--max-old-space-size=2048",
            "reports/marco2b/worker.mjs",
            String(a),
            String(b),
          ],
          { stdio: "inherit" },
        );
        p.on("error", reject);
        p.on("close", (c) =>
          c ? reject(Error(`worker ${a}: ${c}`)) : resolve(null),
        );
      }),
  ),
);
const parts = ranges.map(([a]) =>
    JSON.parse(readFileSync(`reports/marco2b/part-${a}.json`, "utf8")),
  ),
  rows = parts.flatMap((p) => p.rows),
  candidates = parts
    .flatMap((p) => p.stories)
    .sort((a, b) => (a.seed < b.seed ? -1 : 1));
const injured = candidates.find((s) => s.duelSequelaLineage),
  stories = [
    ...(injured ? [injured] : []),
    ...candidates.filter((s) => s !== injured),
  ].slice(0, 3);
const result = {
  engine: "agents-slice-2b",
  noQuota: true,
  invalid: rows.filter((r) => r.errors.length).length,
  rows,
  stories,
};
writeFileSync("docs/MARCO2B-METRICS.json", JSON.stringify(result, null, 2));
console.log(
  JSON.stringify({
    invalid: result.invalid,
    stories: stories.map((s) => ({
      seed: s.seed,
      generation: s.maxGeneration,
      sequela: s.duelSequelaLineage,
    })),
  }),
);
if (result.invalid || stories.length < 3 || !injured) process.exitCode = 1;

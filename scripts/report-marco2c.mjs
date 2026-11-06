import { build } from "esbuild";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
mkdirSync("reports/marco2c", { recursive: true });
const phase = process.argv[2] || "baseline";
const resume = process.argv.includes("--resume");
const counts = phase === "baseline" ? [12] : [12, 40, 100];
const jobs = [];
for (const count of counts)
  for (const prefix of phase === "baseline"
    ? ["linhagem-2b"]
    : ["demografia-2c", "reservado-2b"])
    for (const adjusted of phase === "baseline" ? [false] : [false, true])
      for (let i = 0; i < (phase === "evaluation" && count === 100 && prefix === "reservado-2b" ? 25 : 100); i++) {
        const seed = `${prefix}-${String(i).padStart(3, "0")}`;
        jobs.push({
          id: `${seed}-${count}-${adjusted ? "adjusted" : "baseline"}`,
          seed,
          count,
          adjusted,
        });
      }
writeFileSync(`reports/marco2c/jobs-${phase}.json`, JSON.stringify(jobs));
await build({
  entryPoints: ["scripts/report-marco2c-worker.ts"],
  outfile: "reports/marco2c/worker.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
await Promise.all(
  Array.from(
    { length: 4 },
    (_, i) =>
      new Promise((res, rej) => {
        const p = spawn(
          process.execPath,
          [
            "--max-old-space-size=3072",
            "reports/marco2c/worker.mjs",
            `reports/marco2c/jobs-${phase}.json`,
            String(i),
            "4",
            ...(resume ? ["--resume"] : []),
          ],
          { stdio: "inherit" },
        );
        p.on("error", rej);
        p.on("close", (c) => (c ? rej(Error(String(c))) : res()));
      }),
  ),
);
const rows = jobs.map((j) =>
  JSON.parse(readFileSync(`reports/marco2c/${j.id}.json`, "utf8")),
);
writeFileSync(
  `docs/MARCO2C-${phase.toUpperCase()}.json`,
  JSON.stringify({ phase, rows }, null, 2),
);
if (rows.some((r) => r.error || r.errors.length)) process.exitCode = 1;

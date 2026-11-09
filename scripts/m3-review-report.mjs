import { build } from "esbuild";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const seeds = Array.from(
  { length: 10 },
  (_, i) => `marco3-livre-${String(i).padStart(3, "0")}`,
);
mkdirSync("reports/m3-review", { recursive: true });
writeFileSync(
  "reports/m3-review/manifest.json",
  JSON.stringify(
    {
      seeds,
      founders: 40,
      years: 100,
      mode: "free",
      selection:
        "Lista fixada antes dos resultados; sem quota ou substituição de seed.",
    },
    null,
    2,
  ),
);
await build({
  entryPoints: ["scripts/m3-review-case.ts"],
  outfile: "/tmp/m3-review-case.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
for (const seed of seeds)
  await new Promise((resolve, reject) => {
    const p = spawn(
      process.execPath,
      ["--expose-gc", "/tmp/m3-review-case.mjs", seed],
      { stdio: "inherit" },
    );
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(Error(`${seed}: exit ${code}`)),
    );
  });

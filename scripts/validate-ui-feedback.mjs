import { build } from "esbuild";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
mkdirSync("reports/ui-feedback", { recursive: true });
const seeds = ["reservado-2b-006", "reservado-2b-011", "reservado-2b-028"];
await build({
  entryPoints: ["scripts/ui-feedback-case.ts"],
  outfile: "reports/ui-feedback/case.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
for (const seed of seeds)
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ["reports/ui-feedback/case.mjs", seed], {
      stdio: "inherit",
    });
    p.on("error", reject);
    p.on("exit", (c) => (c ? reject(Error(`Failed ${seed}`)) : resolve()));
  });
const rows = seeds.map((seed) =>
  JSON.parse(readFileSync(`reports/ui-feedback/${seed}.summary.json`, "utf8")),
);
writeFileSync(
  "docs/UI-V2-FEEDBACK-VALIDATION.json",
  JSON.stringify(
    {
      selection:
        "Três seeds reservadas com linhagens afetadas por sequela nos relatórios anteriores, ordenadas pelo número de eventos já medidos em 40 fundadores/100 anos/2c. Exemplos intencionalmente ricos; não estimam distribuição populacional. Nenhuma seed substituída.",
      ranking:
        "Pessoa por seed: presença de sequela 40, ferimento 10, viuvez até 3×8, perda de filho em vida até 3×15; desempate por fatos (até 1 ponto) e ID.",
      rows,
    },
    null,
    2,
  ),
);
let md =
  "# Interface v2 — três biografias após o feedback\n\nSeleção intencional entre resultados anteriores com sequelas: `reservado-2b-006`, `reservado-2b-011`, `reservado-2b-028`. Somente essas três seeds foram geradas em 40 fundadores/100 anos, política 2c sem alteração. Não são fixtures nem amostra representativa de frequência de desfechos. A pessoa de cada seed foi escolhida por ferimento/sequela, viuvez e perda de filho em vida, com ranking auditável no JSON.\n\nNão se infere gênero a partir de nome ou papel gestacional; o texto usa “pais biológicos” e “descendentes diretos”. Guarda, filiação e parceria são vínculos separados.\n";
for (const r of rows) {
  md += `\n## ${r.chosen.name} — ${r.seed}\n\n${r.chosen.wounds} ferimentos; ${r.chosen.sequelae} sequelas confirmadas; ${r.chosen.widowhood} viuvez(es); ${r.chosen.childLosses} perdas de filhos durante a vida.\n\n`;
  for (const p of r.paragraphs) md += `${p.text}\n\n`;
  md += "### Filhos, incluindo mortos\n\n";
  for (const c of r.children) md += `- ${c.name}: ${c.lifespan}.\n`;
  md += "\n### Fontes da narrativa\n\n";
  for (const p of r.paragraphs) md += `- ${p.sources.join(", ")}\n`;
}
writeFileSync("docs/UI-V2-FEEDBACK-BIOGRAFIAS.md", md);

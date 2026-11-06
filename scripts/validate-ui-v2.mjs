import { build } from "esbuild";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
mkdirSync("reports/ui-v2", { recursive: true });
await build({
  entryPoints: ["scripts/validate-ui-v2-case.ts"],
  outfile: "reports/ui-v2/case.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const seeds = ["interface-2c-000", "interface-2c-001", "interface-2c-002"];
for (const seed of seeds)
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ["reports/ui-v2/case.mjs", seed], {
      stdio: "inherit",
    });
    p.on("error", reject);
    p.on("exit", (c) =>
      c ? reject(Error(`Failed ${seed}: ${c}`)) : resolve(),
    );
  });
const rows = seeds.map((seed) =>
  JSON.parse(readFileSync(`reports/ui-v2/${seed}.json`, "utf8")),
);
writeFileSync(
  "docs/UI-V2-VALIDATION.json",
  JSON.stringify(
    {
      method:
        "Três seeds fixadas, 40 fundadores, 100 anos, motor 2c sem alterações. Auditoria demográfica, validação causal e replay; tempos são diagnósticos, não benchmark.",
      rows,
    },
    null,
    2,
  ),
);
let md =
  "# Interface mínima v2 — três biografias reais\n\nSeeds definidas antes de gerar: `interface-2c-000`, `interface-2c-001`, `interface-2c-002`. Todas com 40 fundadores e 100 anos, política `replacement-2c`. Não são fixtures. Seleção de pessoa: vítima agendada do duelo no primeiro mundo; primeira pessoa de geração ≥1 no segundo; primeira de geração ≥2 no terceiro, com fundador como fallback se não houver. Nenhuma seed substituída.\n\nO texto vem exclusivamente de campos conhecidos. Eventos de parentes não implicam percepção, sofrimento ou testemunho. Geração 0 = fundadores. IDs permitem abrir “Por quê?” no mundo da mesma seed. Os trechos abaixo são as biografias integrais, com paginação somente na interface.\n";
for (const r of rows) {
  md += `\n## ${r.name} — seed ${r.seed}\n\n${r.introduction}\n\nPessoa: \`${r.person}\`. Mundo com ${r.people} pessoas registradas, ${r.alive} vivas no fim e ${r.events} eventos. Auditoria: ${r.errors.length} erros; replay idêntico: ${r.replayEqual ? "sim" : "não"}.\n\n`;
  for (const f of r.facts)
    md += `${f.text} [${f.id}; causas: ${f.causes.join(", ") || "nenhuma"}]\n\n`;
}
writeFileSync("docs/UI-V2-BIOGRAFIAS.md", md);

import { readFileSync, writeFileSync } from "node:fs";
const m = JSON.parse(readFileSync("docs/PRE-M2-BENCHMARK.json", "utf8"));
const p = JSON.parse(
  readFileSync("reports/benchmark-pre-m2/core.cpuprofile", "utf8"),
);
const lines = readFileSync(`${m.scratch}/extended.mjs`, "utf8").split("\n");
const nodes = new Map(p.nodes.map((n) => [n.id, n]));
const parents = new Map();
for (const n of p.nodes)
  for (const child of n.children || []) parents.set(child, n.id);
const label = (n) =>
  n.callFrame.url.endsWith("/extended.mjs") &&
  lines[n.callFrame.lineNumber]?.includes("JSON.parse(JSON.stringify(x))")
    ? "clone_JSON"
    : n.callFrame.functionName || "(anonymous)";
const exclusive = {},
  inclusive = {},
  categories = {};
let total = 0;
for (let j = 0; j < p.samples.length; j++) {
  const delta = p.timeDeltas[j],
    stack = [];
  let id = p.samples[j];
  total += delta;
  while (nodes.has(id)) {
    stack.push(label(nodes.get(id)));
    id = parents.get(id);
  }
  exclusive[stack[0]] = (exclusive[stack[0]] || 0) + delta;
  for (const name of new Set(stack))
    inclusive[name] = (inclusive[name] || 0) + delta;
  const category = stack.includes("(garbage collector)")
    ? "GC"
    : stack.includes("clone_JSON")
      ? "JSON copies"
      : stack.includes("freeze")
        ? "freeze"
        : stack.includes("campaignContact") || stack.includes("campaign")
          ? "campaign excluding copies"
          : stack.includes("candidates") || stack.includes("personalityFactors")
            ? "other decisions excluding copies"
            : stack.includes("people") ||
                stack.includes("personalGoals") ||
                stack.includes("allPersonalGoals")
              ? "other entity scans"
              : "other";
  categories[category] = (categories[category] || 0) + delta;
}
const rows = (x) =>
  Object.entries(x)
    .sort((a, b) => b[1] - a[1])
    .map(([name, v]) => ({
      name,
      sampledMs: v / 1000,
      percent: (100 * v) / total,
    }));
const result = {
  totalSampledMs: total / 1000,
  method:
    "timeDelta-weighted V8 samples. Anonymous clone frame recognized by exact generated-source line. Inclusive rows overlap; disjoint categories do not.",
  exclusive: rows(exclusive),
  inclusive: rows(inclusive),
  disjointCategories: rows(categories),
};
writeFileSync("docs/PRE-M2-CPU-PROFILE.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result.disjointCategories));

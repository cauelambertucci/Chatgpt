import { readFileSync, writeFileSync } from "node:fs";
const rows = JSON.parse(
  readFileSync("docs/MARCO2C-EVALUATION.json", "utf8"),
).rows;
// Reject partial or duplicated matrices instead of silently presenting the full matrix.
const expected = new Set();
for (const count of [12, 40, 100])
  for (const prefix of ["demografia-2c", "reservado-2b"])
    for (const adjusted of [false, true])
      for (let i = 0; i < (count === 100 && prefix === "reservado-2b" ? 25 : 100); i++)
        expected.add(`${prefix}-${String(i).padStart(3, "0")}-${count}-${adjusted ? "adjusted" : "baseline"}`);
for (const row of rows) {
  if (!expected.delete(row.id)) throw Error(`Unexpected/duplicate row: ${row.id}`);
}
if (expected.size) throw Error(`Incomplete evaluation: ${expected.size} worlds missing`);
export function summarize(rs) {
  const ok = rs.filter((r) => !r.error),
    sum = (k) => ok.reduce((n, r) => n + (r[k] || 0), 0);
  const exposure = Array.from({ length: 28 }, (_, i) =>
    ok.reduce((n, r) => n + r.exposureMonths[i], 0),
  );
  const births = exposure.map((_, i) =>
    ok.reduce((n, r) => n + r.birthsByAge[i], 0),
  );
  const reasons = (key) =>
    ok.reduce((a, r) => {
      for (const [k, v] of Object.entries(r[key] || {})) a[k] = (a[k] || 0) + v;
      return a;
    }, {});
  return {
    runs: rs.length,
    errors: rs
      .filter((r) => r.error || r.errors?.length)
      .map((r) => ({ seed: r.seed, error: r.error || r.errors })),
    ...Object.fromEntries(
      [
        "initial",
        "births",
        "deaths",
        "naturalDeaths",
        "living",
        "adultCount",
        "partneredAdults",
        "adultGestators",
        "partneredGestators",
        "partnerships",
        "neverConceived",
        "completedGestators",
        "completedBirths",
        "firstBirthCount",
        "firstBirthAgeSum",
        "losses",
        "orphans",
        "guardianshipDecisions",
        "orphanDecisions",
        "accepted",
        "pending",
      ].map((k) => [k, sum(k)]),
    ),
    extinct: ok.filter((r) => r.living === 0).length,
    tfr: births.reduce(
      (n, b, i) => n + (exposure[i] ? b / (exposure[i] / 12) : 0),
      0,
    ),
    missingExposureAges: exposure.flatMap((n, i) => (n ? [] : [18 + i])),
    completedFertility: sum("completedGestators")
      ? sum("completedBirths") / sum("completedGestators")
      : null,
    meanFirstBirth: sum("firstBirthAgeSum") / sum("firstBirthCount"),
    maxPopulation: Math.max(...ok.map((r) => r.peakPopulation)),
    maxLogBytes: Math.max(...ok.map((r) => r.bytes)),
    survivingSeedsWithOrphans: ok.filter((r) => r.living > 0 && r.orphans > 0)
      .length,
    neverConceivedBarriers: reasons("neverConceivedBarriers"),
    neverConceivedDominant: reasons("neverConceivedDominant"),
    neverConceivedBarrierYears: reasons("neverConceivedBarrierYears"),
    exposureMonths: exposure,
    birthsByAge: births,
  };
}
const groups = [];
for (const count of [12, 40, 100])
  for (const prefix of ["demografia-2c", "reservado-2b"])
    for (const adjusted of [false, true])
      groups.push({
        count,
        prefix,
        adjusted,
        ...summarize(
          rows.filter(
            (r) =>
              r.count === count &&
              r.seed.startsWith(prefix) &&
              r.adjusted === adjusted,
          ),
        ),
      });
const baseline = summarize(
  JSON.parse(readFileSync("docs/MARCO2C-BASELINE.json", "utf8")).rows,
);
writeFileSync(
  "docs/MARCO2C-SUMMARY.json",
  JSON.stringify({ baseline, groups }, null, 2),
);
console.log(
  groups.map((g) => ({
    count: g.count,
    prefix: g.prefix,
    adjusted: g.adjusted,
    tfr: g.tfr,
    extinct: g.extinct,
    living: g.living,
    orphans: g.orphans,
    errors: g.errors.length,
  })),
);

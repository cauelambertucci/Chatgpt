/** Read-only annual diagnostic. No RNG stream consumption, effects or decisions. */
import type { SliceWorld, Person } from "./types";
import type { Life } from "./life";
import { sample } from "./rules";
export interface ConceptionDiagnostic {
  reproductiveWindow: boolean;
  month: number;
  pair: string;
  owners: string[];
  desired: number;
  utility: number;
  reasons: string[]; // simultaneous barriers, not an invented exclusive cause
}
export function conceptionDiagnostic(
  w: SliceWorld,
  a: Life,
  month: number,
): ConceptionDiagnostic | undefined {
  if (!a.partner || a.owner > a.partner) return;
  const b = w.entities[`life:${a.partner}`] as Life;
  if (!b) return;
  const l = a.role === "gestational" ? a : b,
    q = l === a ? b : a;
  const p = w.entities[l.owner] as Person,
    other = w.entities[q.owner] as Person;
  const family = p.values.familia + other.values.familia;
  const adjusted =
    w.scenario.lifeSimulation?.fertilityPolicy === "replacement-2c";
  const cost = adjusted ? 30 : 60,
    max = adjusted ? 5 : 3;
  const desired = Math.max(0, Math.min(max, Math.round(family / cost)));
  const utility =
    family -
    l.children * cost -
    (p.psychology?.stress || 0) / 10 -
    (other.psychology?.stress || 0) / 10;
  const reasons: string[] = [];
  if (l.role !== "gestational" || q.role !== "contributor")
    reasons.push("papéis incompatíveis");
  if (!p.alive || !other.alive) reasons.push("morte");
  if (!p.present || !other.present) reasons.push("ausência");
  const age = month - l.birthMonth,
    otherAge = month - q.birthMonth;
  if (age < 216 || age > 540 || otherAge < 216 || otherAge > 780)
    reasons.push("idade");
  if (l.pregnancy) reasons.push("gestação em curso");
  if (l.lastPregnancyEnd !== undefined && month - l.lastPregnancyEnd < 24)
    reasons.push("intervalo");
  if (w.scenario.lifeSimulation?.blockedConceptions?.includes(l.owner))
    reasons.push("bloqueio de fixture");
  if (desired === 0) reasons.push("desejo zero");
  else if (l.children >= desired) reasons.push("desejo satisfeito");
  if (utility < (adjusted ? 15 : 30)) reasons.push("utilidade insuficiente");
  // Partnerships already exclude shared ancestry. Kin barrier is unchanged in conceive().
  if (
    !reasons.length &&
    !(
      w.scenario.lifeSimulation?.conceptionOverride ??
      sample(
        w.scenario.seed,
        `${l.owner}:${Math.floor(month / 12)}:conception`,
        0,
        99,
      ) < 40
    )
  )
    reasons.push("sorteio anual");
  return {
    reproductiveWindow: [a, b].some(
      (x) =>
        x.role === "gestational" &&
        month - x.birthMonth >= 216 &&
        month - x.birthMonth <= 540,
    ),
    month,
    pair: [a.owner, b.owner].sort().join("|"),
    owners: [a.owner, b.owner],
    desired,
    utility,
    reasons,
  };
}

import type { Person } from "./types";
export type ProtectionAction =
  "proteger" | "avisar_alvo" | "pedir_aliados" | "afastar_alvo";
export interface ProtectionEstimate {
  assessedAt: string;
  ownSkill: number;
  attackerSkill: number;
  targetSkill: number;
  ally?: string;
  plans: Record<ProtectionAction, number>;
  best: number;
  model: "heuristic-v1";
}
const chance = (n: number) => Math.max(5, Math.min(95, Math.floor(n)));
/** Decision-time heuristic, not an empirically calibrated probability. Only observable skill and known links. */
export function estimateProtection(
  p: Person,
  target: Person,
  attacker: Person,
  allies: Person[],
  assessedAt: string,
): ProtectionEstimate {
  const trust = p.kin.includes(target.id)
    ? 60
    : p.bonds?.[target.id]?.trust || 0;
  const ally = allies.sort(
    (a, b) => b.skill - a.skill || (a.id < b.id ? -1 : 1),
  )[0];
  const plans = {
    proteger: chance(
      50 + (p.skill + p.traits.coragem * 2 - attacker.skill) / 8,
    ),
    avisar_alvo: chance(40 + (attacker.skill - target.skill) / 20 + trust / 5),
    pedir_aliados: ally
      ? chance(
          45 + (p.skill + ally.skill + p.traits.coragem - attacker.skill) / 10,
        )
      : 0,
    afastar_alvo: chance(45 + (p.skill - attacker.skill) / 18 + trust / 3),
  };
  return {
    assessedAt,
    ownSkill: p.skill,
    attackerSkill: attacker.skill,
    targetSkill: target.skill,
    ally: ally?.id,
    plans,
    best: Math.max(...Object.values(plans)),
    model: "heuristic-v1",
  };
}

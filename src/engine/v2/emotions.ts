import type { Person } from "./types";
export type Stimulus = "perda" | "ameaca" | "vitoria" | "traicao" | "fracasso";
export interface Psychology {
  stress: number;
  needs: {
    seguranca: number;
    descanso: number;
    vinculo: number;
    expressao: number;
  };
  lastEmotion?: string;
  isolatedUntil?: number;
}
export const bounded = (n: number, max = 100) =>
  Math.max(0, Math.min(max, Math.round(n)));
export const initialPsychology = (): Psychology => ({
  stress: 0,
  needs: { seguranca: 0, descanso: 0, vinculo: 0, expressao: 0 },
});
/** Fictional appraisal rules, not a clinical model. Same stimulus, personality-dependent response. */
export function appraise(p: Person, stimulus: Stimulus) {
  const t = p.traits,
    v = p.values;
  const anger = t.rancor + (t.agressividade || 0) + Math.max(0, v.vinganca);
  const care = (t.compaixao || 0) + Math.max(0, v.paz) + (t.autocontrole || 0);
  const anxiety = (t.ansiedade || 0) + t.cautela;
  const intensity =
    stimulus === "vitoria"
      ? 25
      : bounded(45 + (t.sensibilidade || 0) / 3 - (t.esperanca || 0) / 5);
  const delta =
    stimulus === "vitoria"
      ? -intensity
      : intensity * (stimulus === "perda" || stimulus === "traicao" ? 4 : 2);
  let emotion: string, facet: string, belief: string, change: number;
  if (stimulus === "vitoria") {
    emotion = "orgulho";
    facet = "esperanca";
    belief = "honra";
    change = 2;
  } else if (anger > care && anger > anxiety) {
    emotion = stimulus === "perda" ? "luto irado" : "raiva";
    facet = "rancor";
    belief = "vinganca";
    change = 3;
  } else if (anxiety > care) {
    emotion = stimulus === "perda" ? "luto temeroso" : "medo";
    facet = "cautela";
    belief = "paz";
    change = 3;
  } else {
    emotion = stimulus === "perda" ? "luto solidario" : "tristeza reflexiva";
    facet = "compaixao";
    belief = "solidariedade";
    change = 2;
  }
  return {
    stimulus,
    emotion,
    intensity,
    stressDelta: delta,
    facet,
    belief,
    change,
    appraisal: { anger, care, anxiety },
  };
}

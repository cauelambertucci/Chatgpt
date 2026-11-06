import { it, expect } from "vitest";
import { collapsedCausality } from "./causal";
import type { SliceWorld, SliceEvent } from "./types";
it("não contrai dois períodos quando uma decisão externa entre eles depende do primeiro", () => {
  const event = (
    seq: number,
    type: string,
    causes: string[],
    actor: string,
    reference?: string,
  ): SliceEvent => ({
    id: `event:${seq}`,
    seq,
    ano: 0,
    dia: seq * 30,
    month: seq,
    type,
    location: "place:void",
    causes,
    effects: [],
    data: { action: "treinar" },
    participants: [
      { id: actor, role: "actor" },
      ...(reference ? [{ id: reference, role: "reference" as const }] : []),
    ],
    ...(type === "activity.period"
      ? {
          decision: {
            actor,
            chosen: "treinar" as const,
            reason: "teste",
            candidates: [],
          },
        }
      : {}),
  });
  const events = [
    event(0, "world.created", [], "a"),
    event(1, "activity.period", ["event:0"], "a"),
    event(2, "other.responded", ["event:1"], "b", "a"),
    event(3, "activity.period", ["event:2"], "a"),
  ];
  const w = { events } as SliceWorld;
  const graph = collapsedCausality(w, "event:3");
  expect(graph.depth).toBe(4);
  expect(graph.chain).toEqual(["event:0", "event:1", "event:2", "event:3"]);
  expect(
    graph.episodes.filter((e) => e.type === "activity.period"),
  ).toHaveLength(2);
});

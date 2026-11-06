import { describe, it, expect } from "vitest";
import { Archive, lightScenario } from "./model";
import { SliceSimulation } from "../../engine/v2/engine";
import type { SliceEvent } from "../../engine/v2/types";
import type { Life } from "../../engine/v2/life";
const seed = "ui-unit";
const base = new SliceSimulation(lightScenario(seed)).runCompact(1);
function event(
  type: string,
  data: Record<string, unknown> = {},
  participants: SliceEvent["participants"] = [],
): SliceEvent {
  return {
    id: "event:900",
    seq: 900,
    month: 13,
    ano: 1,
    dia: 30,
    type,
    data,
    participants,
    causes: [],
    location: "place:void",
    get effects(): never {
      throw Error("Narration must not expand effects");
    },
  };
}
describe("arquivo v2: fatos e navegação", () => {
  it("usa exatamente 40 fundadores, 100 anos e regras 2c existentes", () => {
    const s = lightScenario("  exemplo  ");
    expect(s.seed).toBe("exemplo");
    expect(s.people).toHaveLength(40);
    expect(s.months).toBe(1200);
    expect(s.lifeSimulation?.fertilityPolicy).toBe("replacement-2c");
  });
  it("não cria infância ou ancestrais para fundadores nem altera o mundo", () => {
    const before = JSON.stringify(base),
      a = new Archive(base);
    expect(a.introduction("person:00")).toContain("Não há infância simulada");
    expect(a.generation("person:00")).toBe(0);
    expect(a.life("person:00")?.parents).toEqual([]);
    a.biography("person:00").forEach((e) => a.narrate(e));
    expect(JSON.stringify(base)).toBe(before);
  });
  it("combina busca sem acentos, situação, mutilação e geração sem confundir sequela com amputação", () => {
    const w = structuredClone(base),
      p = w.entities["person:00"];
    if (p.kind !== "person") throw Error();
    p.name = "Ágata";
    p.alive = false;
    w.entities["test:part"] = {
      kind: "bodyPart",
      id: "test:part",
      owner: p.id,
      part: "hand.left",
      present: false,
      nerve: 0,
      bone: 0,
      lastEvent: "event:0",
    };
    const a = new Archive(w);
    expect(
      a
        .filter({
          query: "agata",
          status: "dead",
          mutilated: "yes",
          generation: "0",
        })
        .map((p) => p.id),
    ).toEqual([p.id]);
    expect(a.filter({ query: "agata", status: "alive" })).toEqual([]);
    expect(a.filter({ mutilated: "no" })).toHaveLength(39);
  });
  it("calcula gerações por ascendência e contém ciclos sem inventar ancestrais", () => {
    const w = structuredClone(base);
    (w.entities["life:person:01"] as Life).parents = ["person:00"];
    (w.entities["life:person:02"] as Life).parents = ["person:01"];
    let a = new Archive(w);
    expect(a.generation("person:02")).toBe(2);
    expect(a.children.get("person:01")).toEqual(["person:02"]);
    (w.entities["life:person:00"] as Life).parents = ["person:02"];
    a = new Archive(w);
    expect(a.generation("person:02")).toBe(null);
  });
  it("narra lesão e transformação somente com campos presentes, sem adjetivar nem inventar agressor", () => {
    const a = new Archive(base),
      p = [{ id: "person:01", role: "victim" as const }],
      e = event("wound.created", { part: "hand.left", amputation: true }, p),
      text = a.narrate(e);
    expect(text).toContain("mão esquerda");
    expect(text).toContain("amputação registrada");
    expect(text).not.toContain(a.name("person:00"));
    expect(text).not.toContain("fratura");
    const change = a.narrate(
      event(
        "person.transformed",
        { facet: "coragem", facetBefore: 40, facetAfter: 39 },
        [{ id: "person:01", role: "actor" }],
      ),
    );
    expect(change).toContain("Coragem passou de 40 para 39");
    expect(change).not.toMatch(/covarde|bravo|herói/);
    expect(change).not.toContain("undefined");
  });
  it("não atribui assassino a morte natural nem transforma parentesco em percepção", () => {
    const a = new Archive(base),
      e = event("person.died", {
        victim: "person:00",
        natural: true,
        cause: "morte natural: declínio fisiológico",
        killer: null,
      });
    expect(a.narrate(e)).toContain("morte natural");
    expect(a.narrate(e)).not.toContain("atribuída");
    expect(a.narrate(e)).not.toMatch(/soube|sentiu|lamentou/);
  });
  it("navega causas pelo ID gravado e rejeita referências inválidas", () => {
    const a = new Archive(base),
      e = a.event(5)!;
    expect(a.event(e.id)?.id).toBe(e.id);
    for (const id of e.causes) expect(a.event(id)!.seq).toBeLessThan(e.seq);
    expect(a.event("event:-1")).toBeUndefined();
    expect(a.event("event:99999999")).toBeUndefined();
    expect(a.event("foo")).toBeUndefined();
  });
});

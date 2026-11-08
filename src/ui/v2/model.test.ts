import { describe, it, expect } from "vitest";
import ts from "typescript";
import { Archive, lightScenario, eventLabel } from "./model";
import { eventLabels } from "./labels";
import { SliceSimulation } from "../../engine/v2/engine";
import { CompactLog, type CompactWorld } from "../../engine/v2/compact-log";
import type { SliceEvent } from "../../engine/v2/types";
const base = new SliceSimulation(lightScenario("ui-unit")).runCompact(1);
function fixture() {
  const w = structuredClone(base),
    log = new CompactLog(),
    events: SliceEvent[] = [];
  const add = (
    type: string,
    month: number,
    data: Record<string, unknown>,
    people: string[],
    causes: string[] = [],
  ) => {
    const e: SliceEvent = {
      id: `event:${events.length}`,
      seq: events.length,
      type,
      month,
      ano: Math.floor(month / 12),
      dia: (month % 12) * 30,
      location: "place:void",
      data,
      causes,
      participants: people.map((id, i) => ({
        id,
        role: i === 0 ? "actor" : "reference",
      })),
      effects: [],
    };
    events.push(e);
    log.append(log.encodeEvent(e, {}));
    return e;
  };
  const root = add("world.created", 0, {}, []);
  for (const [id, birthMonth] of [
    ["person:00", -360],
    ["person:01", -300],
    ["person:04", -336],
    ["person:06", -300],
  ] as const)
    add("family.founder.registered", 0, { birthMonth }, [id], [root.id]);
  const born = add(
    "person.born",
    12,
    {
      parents: ["person:00", "person:01"],
      guardians: ["person:00"],
      birthMonth: 12,
    },
    ["person:02", "person:00", "person:01"],
  );
  const partnership = add("partnership.formed", 24, {}, [
    "person:00",
    "person:01",
  ]);
  add(
    "person.born",
    36,
    {
      parents: ["person:00", "person:01"],
      guardians: ["person:00", "person:01"],
      birthMonth: 36,
    },
    ["person:03", "person:00", "person:01"],
  );
  add(
    "person.born",
    48,
    {
      parents: ["person:00", "person:01"],
      guardians: ["person:00", "person:01"],
      birthMonth: 48,
    },
    ["person:05", "person:00", "person:01"],
  );
  const development = add(
    "development.period",
    48,
    {},
    ["person:02"],
    [born.id],
  );
  const death = add(
    "person.died",
    60,
    { victim: "person:02", cause: "causa registrada de teste", killer: null },
    ["person:02"],
    [development.id],
  );
  const shared = add(
    "information.shared",
    61,
    { sender: "person:01", recipient: "person:00", offense: death.id },
    ["person:01", "person:00"],
    [death.id],
  );
  const routine = add(
    "needs.period",
    61,
    { periodMonths: 1 },
    ["person:00"],
    [root.id],
  );
  const news = add(
    "information.received",
    61,
    { offense: death.id, source: shared.id, channel: "relato" },
    ["person:00", "person:02"],
    [routine.id, shared.id],
  );
  const emotion = add(
    "emotion.felt",
    61,
    {
      emotion: "tristeza reflexiva",
      stimulusSource: news.id,
      stressBefore: 10,
      stressAfter: 40,
    },
    ["person:00"],
    [routine.id, news.id],
  );
  const transform = add(
    "person.transformed",
    61,
    { facet: "coragem", facetBefore: 40, facetAfter: 42, emotion: emotion.id },
    ["person:00"],
    [routine.id, emotion.id],
  );
  const partnerDeath = add(
    "person.died",
    120,
    { victim: "person:01", cause: "morte natural", killer: null },
    ["person:01"],
  );
  add(
    "partnership.ended",
    120,
    { cause: "morte", death: partnerDeath.id },
    ["person:01", "person:00"],
    [partnership.id, partnerDeath.id],
  );
  add("partnership.formed", 132, {}, ["person:00", "person:04"]);
  add("partnership.ended", 180, { cause: "ruptura" }, [
    "person:00",
    "person:04",
  ]);
  add("partnership.formed", 192, {}, ["person:00", "person:04"]);
  const parentDeath = add(
    "person.died",
    240,
    { victim: "person:00", cause: "morte natural", killer: null },
    ["person:00"],
  );
  add("partnership.ended", 240, { cause: "morte", death: parentDeath.id }, [
    "person:00",
    "person:04",
  ]);
  add("partnership.formed", 252, {}, ["person:03", "person:06"]);
  add(
    "person.died",
    300,
    { victim: "person:05", cause: "morte natural", killer: null },
    ["person:05"],
  );
  w.log = log.snapshot();
  w.nextMonth = 1200;
  w.complete = true;
  return {
    w,
    events,
    born,
    death,
    shared,
    news,
    emotion,
    transform,
    routine,
    development,
  };
}
describe("arquivo v2: histórico familiar e narrativa", () => {
  it("preserva 40 fundadores, 100 anos e a política atual", () => {
    const s = lightScenario("  exemplo  ");
    expect(s.seed).toBe("exemplo");
    expect(s.people).toHaveLength(40);
    expect(s.months).toBe(1200);
    expect(s.lifeSimulation?.fertilityPolicy).toBe("replacement-2c");
  });
  it("lista todos os filhos e mortes pelo log, mesmo com estado final contraditório ou ausente", () => {
    const { w } = fixture();
    delete w.entities["life:person:00"];
    delete w.entities["life:person:02"];
    delete w.entities["life:person:03"];
    const a = new Archive(w);
    expect(a.children.get("person:00")).toEqual([
      "person:02",
      "person:03",
      "person:05",
    ]);
    expect(a.isAlive("person:02")).toBe(false);
    expect(a.isAlive("person:03")).toBe(true);
    expect(a.isAlive("person:05")).toBe(false);
    expect(a.lifeSpan("person:02")).toContain("nascimento: ano 1");
    expect(a.lifeSpan("person:02")).toContain("morta: ano 5, aos 4 anos");
    expect(a.family.age("person:02", 23)).toBe(0);
  });
  it("separa guarda de pais biológicos sem assumir que são iguais", () => {
    const a = new Archive(fixture().w);
    expect(a.family.parents("person:02")).toEqual(["person:00", "person:01"]);
    expect(a.family.custody.get("person:02")?.[0].guardians).toEqual([
      "person:00",
    ]);
    expect(a.family.parents("person:00")).toEqual([]);
  });
  it("preserva viuvez, ruptura, nova parceria com a mesma pessoa e vigência após consultar pessoa morta", () => {
    const a = new Archive(fixture().w),
      p = a.family.partners("person:00");
    expect(a.isAlive("person:00")).toBe(false);
    expect(p.map((p) => [p.start, p.end, a.partnershipReason(p)])).toEqual([
      [24, 120, "morte"],
      [132, 180, "ruptura"],
      [192, 240, "morte"],
    ]);
    expect(a.partnershipReason(a.family.partners("person:03")[0])).toBe(
      "vigente",
    );
  });
  it("deriva irmãos, descendentes e gerações do nascimento; fundadores não ganham ancestrais", () => {
    const a = new Archive(fixture().w);
    expect(a.family.siblings("person:02")).toEqual(["person:03", "person:05"]);
    expect(a.generation("person:02")).toBe(1);
    expect(a.generation("person:00")).toBe(0);
    expect(a.introduction("person:00")).toContain("Não há infância simulada");
  });
  it("contém ciclos em registros importados sem recursão infinita", () => {
    const a = new Archive(fixture().w);
    a.family.births.set("person:00", {
      id: "person:00",
      month: 0,
      parents: ["person:02"],
      founder: false,
      source: "event:0",
    });
    a.family.generations.clear();
    expect(a.generation("person:02")).toBe(null);
  });
  it("combina busca, estado derivado do log, mutilação e geração", () => {
    const { w } = fixture();
    const p = w.entities["person:02"];
    if (p.kind !== "person") throw Error();
    p.name = "Ágata";
    p.alive = true;
    w.entities["test:part"] = {
      id: "test:part",
      kind: "bodyPart",
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
          generation: "1",
        })
        .map((p) => p.id),
    ).toEqual([p.id]);
    expect(a.filter({ query: "agata", status: "alive" })).toEqual([]);
  });
  it("explica fato sabido, relação de parentesco e quem transmitiu o relato", () => {
    const { w, news } = fixture(),
      a = new Archive(w),
      text = a.narrate(news);
    expect(text).toContain(`a morte de ${a.name("person:02")}`);
    expect(text).toContain("descendentes diretos");
    expect(text).toContain(`relato de ${a.name("person:01")}`);
    expect(text).not.toContain("information.received");
  });
  it("distingue testemunho de relato e não inventa uma fonte ausente", () => {
    const { w, news, death } = fixture(),
      a = new Archive(w);
    expect(
      a.narrate({
        ...news,
        data: { ...news.data, source: death.id, channel: "testemunho" },
      }),
    ).toContain("testemunho do acontecimento");
    expect(a.narrate({ ...news, data: { offense: death.id } })).toContain(
      "fonte não especificada",
    );
  });
  it("só atribui emoção a um estímulo explicitamente registrado como causa", () => {
    const { w, emotion } = fixture(),
      a = new Archive(w);
    expect(a.narrate(emotion)).toContain("Ao saber da morte");
    expect(a.narrate(emotion)).toContain("O estresse aumentou");
    expect(a.narrate(emotion)).not.toContain("de 10 para 40");
    expect(a.narrate({ ...emotion, causes: [] })).not.toContain(
      "em resposta a",
    );
  });
  it("prioriza notícia e emoção, deixando necessidades e desenvolvimento fora da cadeia visível", () => {
    const { w, transform, news, emotion, routine } = fixture(),
      a = new Archive(w),
      p = a.causalPresentation(transform);
    expect(p.chain.map((e) => e.id)).toEqual(
      expect.arrayContaining([news.id, emotion.id, transform.id]),
    );
    expect(p.chain.map((e) => e.type)).not.toContain("needs.period");
    expect(p.chain.map((e) => e.type)).not.toContain("development.period");
    expect(p.routine.map((e) => e.id)).toContain(routine.id);
    for (let i = 1; i < p.chain.length; i++)
      expect(p.chain[i].seq).toBeGreaterThan(p.chain[i - 1].seq);
  });
  it("produz parágrafos com fontes, idade e causa de morte, sem atribuir percepção apenas pelo parentesco", () => {
    const a = new Archive(fixture().w),
      paras = a.paragraphs("person:00");
    expect(paras.some((p) => p.sources.length > 1)).toBe(true);
    expect(paras.map((p) => p.text).join(" ")).toContain("aos 50 anos");
    const childNarrative = a
      .paragraphs("person:03")
      .map((p) => p.text)
      .join(" ");
    expect(childNarrative).not.toContain("tristeza reflexiva");
    expect(a.children.get("person:00")).toContain("person:05");
    expect(a.biography("person:00").some((e) => e.month > 240)).toBe(false);
  });
  it("não expande efeitos, inventa ferimentos adicionais ou atribui assassino a morte natural", () => {
    const { w, death } = fixture(),
      a = new Archive(w),
      e: SliceEvent = {
        ...death,
        type: "wound.created",
        participants: [{ id: "person:00", role: "victim" }],
        data: { part: "hand.left", amputation: true },
        get effects(): never {
          throw Error("expansão indevida");
        },
      };
    const text = a.narrate(e);
    expect(text).toContain("mão esquerda");
    expect(text).toContain("amputação");
    expect(text).not.toContain("fratura");
    expect(a.narrate(death)).not.toContain("atribuída");
  });
  it("não altera o mundo nem usa estado final para recalcular vínculos", () => {
    const w = fixture().w,
      before = JSON.stringify(w),
      a = new Archive(w);
    a.paragraphs("person:00");
    a.causalPresentation(a.event(10)!);
    expect(JSON.stringify(w)).toBe(before);
    expect(a.event("bad")).toBeUndefined();
  });
});
it("não narra um duelo iniciado quando houve apenas avaliação recusada", () => {
  const { w, death } = fixture(),
    a = new Archive(w);
  const e = {
    ...death,
    type: "duel.agreed",
    data: { started: false },
    participants: [
      { id: "person:00", role: "actor" as const },
      { id: "person:01", role: "target" as const },
    ],
  };
  expect(a.narrate(e)).toContain("o duelo não foi iniciado");
  expect(a.narrate(e)).not.toContain("combinaram um duelo");
});
it("distingue pessoas homônimas sem inventar identidade ou misturar mortes", () => {
  const { w } = fixture();
  const p = w.entities["person:00"],
    q = w.entities["person:01"];
  if (p.kind !== "person" || q.kind !== "person") throw Error();
  p.name = q.name = "Orin";
  const a = new Archive(w);
  expect(a.name(p.id)).not.toBe(a.name(q.id));
  expect(a.name(p.id)).toContain("Orin (registro");
  expect(a.lifeSpan(p.id)).not.toBe(a.lifeSpan(q.id));
});
describe("catálogo obrigatório de tipos do motor", () => {
  it("todo tipo emitido pelo motor possui rótulo em português", () => {
    const sources = import.meta.glob<string>("../../engine/v2/*.ts", {
        query: "?raw",
        import: "default",
        eager: true,
      }),
      types = new Set<string>();
    for (const [file, source] of Object.entries(sources)) {
      if (file.endsWith(".test.ts")) continue;
      const ast = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
      );
      const extract = (node: ts.Node) => {
        if (ts.isStringLiteral(node)) types.add(node.text);
        else if (ts.isConditionalExpression(node)) {
          extract(node.whenTrue);
          extract(node.whenFalse);
        } else
          expect(
            ts.isSpreadElement(node),
            `Tipo dinâmico não verificado em ${file}`,
          ).toBe(true);
      };
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "emit" &&
          node.arguments[0]
        )
          extract(node.arguments[0]);
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
    expect(types.size).toBeGreaterThan(100);
    for (const type of types) {
      expect(eventLabels[type], `Falta rótulo para ${type}`).toBeTruthy();
      expect(eventLabel({ type })).not.toContain(type);
    }
  });
  it("um tipo desconhecido nunca vaza como código na apresentação", () => {
    expect(eventLabel({ type: "new.unknown.event" })).toBe(
      "Acontecimento sem descrição disponível",
    );
  });
});

describe("prosa por fases, sem alterar fatos", () => {
  it("agrupa cada momento, conserva todas as fontes e é determinística", () => {
    const { w, news, emotion, transform } = fixture(),
      a = new Archive(w),
      first = a.paragraphs("person:00");
    expect(a.paragraphs("person:00")).toEqual(first);
    expect(first[0].phase).toBe("Origem");
    const episode = first.find((p) => p.sources.includes(news.id))!;
    expect(episode.sources).toEqual(
      expect.arrayContaining([emotion.id, transform.id]),
    );
    expect(first.filter((p) => p.sources.includes(news.id))).toHaveLength(1);
    expect(first.flatMap((p) => p.sources).sort()).toEqual(
      a
        .biography("person:00")
        .map((e) => e.id)
        .sort(),
    );
    expect(
      episode.text.match(/No ano 5, mês 2,/g)?.length || 0,
    ).toBeLessThanOrEqual(1);
  });
  it("oculta números pequenos e mudanças nulas; mantém mudanças notáveis no Por quê", () => {
    const { w, emotion, transform } = fixture(),
      a = new Archive(w);
    expect(
      a.narrate({
        ...emotion,
        data: { ...emotion.data, stressBefore: 0, stressAfter: 0 },
      }),
    ).not.toContain("estresse");
    expect(
      a.narrate({
        ...emotion,
        data: { ...emotion.data, stressBefore: 1000, stressAfter: 1000 },
      }),
    ).not.toContain("1000");
    expect(
      a.narrate({
        ...emotion,
        data: { ...emotion.data, stressBefore: 0, stressAfter: 200 },
      }),
    ).toContain("de 0 para 200");
    const small = {
      ...transform,
      data: {
        ...transform.data,
        facet: "rancor",
        facetBefore: 50,
        facetAfter: 53,
      },
    };
    expect(a.narrate(small)).toContain("mais rancor");
    expect(a.narrate(small)).not.toContain("53");
    expect(
      a.narrate({ ...small, data: { ...small.data, facetAfter: 65 } }),
    ).toContain("50 para 65");
  });
  it("resume eleição sem despejar testemunhas na prosa", () => {
    const { w, emotion } = fixture(),
      a = new Archive(w);
    const e = {
      ...emotion,
      type: "leadership.changed",
      data: {},
      participants: [
        { id: "person:00", role: "actor" as const },
        ...a.people
          .slice(1, 30)
          .map((p) => ({ id: p.id, role: "witness" as const })),
      ],
    };
    const text = a.narrate(e);
    expect(text).toContain("coordenar o grupo");
    expect(text).not.toContain(a.name("person:01"));
    expect(e.participants).toHaveLength(30);
  });
  it("título vem do tema e não reescreve nome histórico ou entidades", () => {
    const { w, death } = fixture();
    w.entities["work:test"] = {
      id: "work:test",
      kind: "work",
      name: "Caderno de autor",
      creator: "person:00",
      goal: "test",
      theme: death.id,
      quality: 50,
      source: death.id,
      created: 100,
      material: "papel e tinta",
    };
    const a = new Archive(w),
      before = JSON.stringify(w);
    expect(a.workTitle("work:test")).toBe(
      `Caderno sobre a morte de ${a.name("person:02")}`,
    );
    expect(JSON.stringify(w)).toBe(before);
  });
});

it("cronologia global, anos completos e velhice só após os 60", () => {
  const { w } = fixture(),
    a = new Archive(w),
    ps = a.paragraphs("person:00");
  const months = ps.flatMap((p) => p.sources.map((id) => a.event(id)!.month));
  expect(months).toEqual([...months].sort((a, b) => a - b));
  expect(ps.map((p) => p.text).join(" ")).not.toMatch(/Em \d+,/);
  for (const p of ps.filter((p) => p.phase === "Velhice"))
    for (const id of p.sources)
      expect(
        a.family.age("person:00", a.event(id)!.month),
      ).toBeGreaterThanOrEqual(60);
  for (const p of ps)
    expect(
      (p.text.match(/Ao longo desta fase/g) || []).length,
    ).toBeLessThanOrEqual(1);
});

it("separa a passagem dos 59 para os 60 sem puxar causas antigas para a velhice", () => {
  const { w, events, transform } = fixture(),
    log = CompactLog.from(w.log);
  for (const month of [383, 384]) {
    const e: SliceEvent = {
      ...transform,
      id: `event:${log.length}`,
      seq: log.length,
      month,
      ano: Math.floor(month / 12),
      participants: [{ id: "person:04", role: "actor" }],
      data: { ...transform.data, facetBefore: 40, facetAfter: 42 },
    };
    log.append(log.encodeEvent(e, {}));
  }
  w.log = log.snapshot();
  const a = new Archive(w),
    ps = a.paragraphs("person:04");
  const elder = ps.find((p) => p.phase === "Velhice")!;
  expect(elder).toBeDefined();
  expect(elder.sources.map((id) => a.event(id)!.month)).toEqual([384]);
  let phase = "";
  const adultSources = ps.flatMap((p) => {
    phase = p.phase || phase;
    return phase === "Vida adulta" ? p.sources : [];
  });
  expect(adultSources.map((id) => a.event(id)!.month)).toContain(383);
});

it("divide vida adulta por década preservando cronologia e resume mortes simultâneas", () => {
  const { w, death } = fixture(),
    log = CompactLog.from(w.log);
  const e: SliceEvent = {
    ...death,
    id: `event:${log.length}`,
    seq: log.length,
    month: 120,
    ano: 10,
    participants: [{ id: "person:03", role: "victim" }],
    data: { victim: "person:03", cause: "morte natural", killer: null },
  };
  log.append(log.encodeEvent(e, {}));
  w.log = log.snapshot();
  const a = new Archive(w),
    ps = a.paragraphs("person:00");
  expect(ps.length).toBeGreaterThan(3);
  for (const p of ps.slice(1)) {
    const decades = new Set(
      p.sources.map((id) => Math.floor(a.event(id)!.month / 120)),
    );
    expect(decades.size).toBe(1);
  }
  const text = ps.map((p) => p.text).join(" ");
  expect(text).toContain("morreram no mesmo mês por morte natural");
  expect(text).toContain("(35 anos)");
  expect(text).toContain("(7 anos)");
  expect(ps.flatMap((p) => p.sources)).toContain(e.id);
});

it('narra colheitas antigas sem inventar desgaste que não foi registrado',()=>{const {w,transform}=fixture(),a=new Archive(w);const text=a.narrate({...transform,type:'livelihood.period',data:{task:'cultivar',food:24,toolsUsed:1}});expect(text).toContain('24');expect(text).not.toContain('undefined');expect(text).not.toContain('desgaste');});

it('resume 14 livros repetidos e preserva primeiro, último, excepcional e todas as fontes',()=>{
 const {w}=fixture(),log=CompactLog.from(w.log);const created:string[]=[];
 const add=(type:string,month:number,data:Record<string,unknown>,actor:string)=>{const e:SliceEvent={id:`event:${log.length}`,seq:log.length,type,month,ano:Math.floor(month/12),dia:0,location:'place:void',causes:[],participants:[{id:actor,role:'actor'}],effects:[],data};log.append(log.encodeEvent(e,{}));return e;};
 for(let i=0;i<14;i++){
  const fact=add('person.died',60+i,{victim:`person:${String(i+10).padStart(2,'0')}`,cause:'morte natural'},`person:${String(i+10).padStart(2,'0')}`);
  const wid=`work:summary:${i}`,goal=`goal:summary:${i}`,quality=i===6?100:60;
  const event=add('work.created',80+i,{work:wid,goal,quality},'person:00');created.push(event.id);
  w.entities[wid]={id:wid,kind:'work',name:'Caderno',creator:'person:00',owner:'person:00',goal,theme:fact.id,quality,source:event.id,created:event.month,material:'papel e tinta'};
 }
 w.log=log.snapshot();const a=new Archive(w),ps=a.paragraphs('person:00'),text=ps.map(p=>p.text).join(' ');
 expect(text).toContain('escreveu 14 livros sobre mortes que conheceu');expect(text.match(/concluiu Caderno/g)).toHaveLength(3);
 expect(ps.flatMap(p=>p.sources)).toEqual(expect.arrayContaining(created));
});

it('métrica final conta pessoas vivas e domicílios distintos com menores de 18',()=>{
 const {w}=fixture();w.nextMonth=150;
 const a=new Archive(w),expectedHomes=new Set(a.people.filter(p=>a.isAlive(p.id) && (a.family.age(p.id,150)??100)>=0 && (a.family.age(p.id,150)??100)<18).map(p=>(w.entities[`life:${p.id}`] as any).household));
 expect(expectedHomes.size).toBeGreaterThan(0);expect(a.populationMetrics()).toEqual({alive:a.people.filter(p=>a.isAlive(p.id)).length,householdsWithChildren:expectedHomes.size});
});

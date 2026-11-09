import { it, expect } from "vitest";
import { Archive, lightScenario } from "./model";
import {
  WorldArchive,
  worldMarkdown,
  personMarkdown,
  markdownText,
} from "./world-model";
import { profileScenario, estimateProfile } from "./profiles";
import { SliceSimulation } from "../../engine/v2/engine";
import { CompactLog } from "../../engine/v2/compact-log";
import type { SliceEvent } from "../../engine/v2/types";
function fixture() {
  const w = structuredClone(
      new SliceSimulation(lightScenario("world-ui")).runCompact(1),
    ),
    log = new CompactLog();
  let seq = 0;
  const add = (
    type: string,
    data: Record<string, unknown>,
    people: string[] = [],
  ) => {
    const e: SliceEvent = {
      id: `event:${seq}`,
      seq: seq++,
      type,
      month: 0,
      ano: 0,
      dia: 0,
      location: "place:void",
      data,
      participants: people.map((id) => ({ id, role: "actor" })),
      causes: [],
      effects: [],
    };
    log.append(log.encodeEvent(e, {}));
    return e;
  };
  add("world.created", {});
  add("family.founder.registered", { birthMonth: -240 }, ["person:00"]);
  add("family.founder.registered", { birthMonth: -240 }, ["person:01"]);
  add(
    "office.appointed",
    {
      settlement: "settlement:0",
      leader: "person:00",
      termEnd: 120,
      reason: "apoio",
    },
    ["person:00"],
  );
  add("office.vacated", { settlement: "settlement:0", reason: "morte" }, [
    "person:00",
  ]);
  add("work.created", { work: "work:test" }, ["person:00"]);
  add(
    "property.stolen",
    { work: "work:test", from: "person:00", to: "person:01" },
    ["person:01", "person:00"],
  );
  add("work.estate.recorded", { work: "work:test", owner: "person:01" }, [
    "person:01",
  ]);
  add("needs.period", {}, ["person:00"]);
  w.log = log.snapshot();
  return { w, view: new WorldArchive(new Archive(w)) };
}
it("profiles change scale only and preserve native Leve", () => {
  expect(profileScenario("x", "leve")).toEqual(lightScenario("x"));
  const p = profileScenario("x", "padrao"),
    ep = profileScenario("x", "epico");
  expect(p.people).toEqual(ep.people.slice(0, 70));
  expect(p.months).toBe(1200);
  expect({ ...p, people: [], schedules: [] }).toEqual({
    ...ep,
    people: [],
    schedules: [],
  });
  expect(estimateProfile("epico").kind).toBe("extrapolação");
});
it("historical leadership retains ended mandate", () => {
  const { view } = fixture();
  expect(view.terms.get("settlement:0")?.[0]).toMatchObject({
    person: "person:00",
    end: 0,
    endSource: "event:4",
  });
});
it("custody preserves creation, theft and estate separately", () => {
  const { view } = fixture();
  expect(view.custody.get("work:test")?.map((c) => [c.kind, c.owner])).toEqual([
    ["creation", "person:00"],
    ["theft", "person:01"],
    ["estate", "person:01"],
  ]);
});
it("filters intersect and explicit routine type remains accessible", () => {
  const { view } = fixture();
  expect(view.filter({ type: "property.stolen", person: "person:00" })).toEqual(
    [6],
  );
  expect(view.filter({ type: "property.stolen", person: "absent" })).toEqual(
    [],
  );
  expect(view.filter({ type: "needs.period" })).toEqual([8]);
});
it("projection and exports do not mutate compact data", () => {
  const { w, view } = fixture(),
    before = JSON.stringify(w);
  expect([...worldMarkdown(view)].join("")).toContain("Crônica do mundo");
  expect([...personMarkdown(view.archive, "person:00")].join("")).toContain(
    "Fontes:",
  );
  expect(JSON.stringify(w)).toBe(before);
  expect(markdownText("<script>*")).toBe("\\<script\\>\\*");
});
it("routes retain engine distances and current population partitions", () => {
  const { view } = fixture();
  expect(view.routes().map((r) => r.km)).toEqual([60, 90, 60]);
  expect(
    view.settlements.reduce((n, s) => n + view.population(s.id).length, 0),
  ).toBe(view.archive.populationMetrics().alive);
});
it('a live war outranks older agreements and closure returns peace',()=>{const {w}=fixture();const base={id:'dispute:test',kind:'dispute' as const,from:'settlement:0',to:'settlement:1',incident:'event:6',witness:'person:00',sent:'event:6',due:1,lastEvent:'event:6',status:'declared' as const};w.entities[base.id]=base;w.entities['dispute:old']={...base,id:'dispute:old',status:'closed',outcome:'agreement',lastEvent:'event:5'};expect(new WorldArchive(new Archive(w)).relations()[0].state).toBe('guerra');w.entities[base.id]={...base,status:'closed',outcome:'campaign_ended'};expect(new WorldArchive(new Archive(w)).relations()[0].state).toBe('paz');});
it('dead leaders are not presented as current officeholders',()=>{const {w}=fixture();const s=w.entities['settlement:0'];if(s.kind!=='settlement')throw Error('settlement');s.leader='person:00';s.mandate='event:3';s.termEnd=120;const p=w.entities['person:00'];if(p.kind!=='person')throw Error('person');p.alive=false;expect(new WorldArchive(new Archive(w)).currentLeader(s)).toBeUndefined();});
it('settlement filters preserve residence at the event, including both sides of a move',()=>{const {w}=fixture(),log=CompactLog.from(w.log);const e:SliceEvent={id:'event:9',seq:9,type:'partnership.formed',month:12,ano:1,dia:0,location:'place:void',data:{household:'home:person:00'},participants:[{id:'person:00',role:'actor'},{id:'person:01',role:'actor'}],causes:[],effects:[]};log.append(log.encodeEvent(e,{}));w.log=log.snapshot();const v=new WorldArchive(new Archive(w));expect(v.residenceAt('person:01',6)).toBe('home:person:01');expect(v.residenceAt('person:01',9)).toBe('home:person:00');expect(v.filter({settlement:'settlement:1',type:'property.stolen'})).toContain(6);expect(v.filter({settlement:'settlement:1',type:'partnership.formed'})).toContain(9);expect(v.filter({settlement:'settlement:0',type:'partnership.formed'})).toContain(9);});

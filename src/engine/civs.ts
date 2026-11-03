import type { World, Params, Geography } from "../types";
import { rng, pick } from "./rng";
import { name } from "./names";
import { races, civColors } from "../data/catalog";
export function populate(params: Params, geography: Geography): World {
  const r = rng(params.seed + ":civs");
  const world: World = {
    version: 1,
    params,
    geography,
    cultures: [],
    civs: [],
    settlements: [],
    people: [],
    creatures: [],
    events: [],
    artifacts: [],
  };
  const occupied = new Set<number>();
  for (let i = 0; i < params.civs; i++) {
    const culture = {
      id: `u${i}`,
      name: `Povo ${name(r, i)}`,
      race: races[i],
      traits: [pick(r, ["nômades", "navegadores", "artífices", "eruditos"])],
      values: [pick(r, ["comércio", "guerra", "tradição", "magia"])],
      preferred: [
        [3, 4],
        [8, 7],
        [6, 9],
        [2, 1],
      ][i % 4],
      religion: `Círculo de ${name(r, i)}`,
      god: name(r, i),
      style: i % 4,
    };
    world.cultures.push(culture);
    const civ = {
      id: `c${i}`,
      kind: "civilização" as const,
      name: `${pick(r, ["Reino", "Liga", "Domínio", "Confederação"])} de ${name(r, i)}`,
      culture: culture.id,
      government: pick(r, ["monarquia", "república", "clã", "teocracia"]),
      capital: `s${i * 3}`,
      population: 0,
      resources: [
        pick(r, ["ferro", "madeira", "cristais", "ouro"]),
        "alimentos",
      ],
      relations: {} as Record<string, string>,
      leader: "",
      color: civColors[i],
    };
    while (world.civs.some((existing) => existing.name === civ.name))
      civ.name = `${pick(r, ["Reino", "Liga", "Domínio", "Confederação"])} de ${name(r, i)}`;
    world.civs.push(civ);
    for (let j = 0; j < 3; j++) {
      let best = -1,
        score = -Infinity;
      for (let n = 0; n < 450; n++) {
        const t = Math.floor(r() * geography.tiles.length),
          tile = geography.tiles[t];
        if (tile.water || tile.biome === 10 || occupied.has(t)) continue;
        const rating =
          (culture.preferred.includes(tile.biome) ? 4 : 0) +
          (tile.river ? 3 : 0) +
          tile.rain +
          r();
        if (rating > score) {
          best = t;
          score = rating;
        }
      }
      if (best < 0)
        best = geography.tiles.findIndex(
          (t, k) => !t.water && !occupied.has(k),
        );
      if (best < 0) throw Error("Sem terra habitável");
      occupied.add(best);
      const population = 200 + Math.floor(r() * 1500);
      world.settlements.push({
        id: `s${i * 3 + j}`,
        kind: "assentamento",
        name: name(r, i),
        civ: civ.id,
        tile: best,
        population,
        founded: 0,
      });
      civ.population += population;
    }
  }
  world.civs.forEach((c) =>
    world.civs
      .filter((o) => o !== c)
      .forEach((o) => (c.relations[o.id] = "paz")),
  );
  geography.tiles.forEach((t, i) => {
    if (t.water) return;
    let distance = Infinity;
    for (const s of world.settlements) {
      const d =
        ((s.tile % params.size) - (i % params.size)) ** 2 +
        (Math.floor(s.tile / params.size) - Math.floor(i / params.size)) ** 2;
      if (d < distance) {
        distance = d;
        t.owner = s.civ;
      }
    }
  });
  for (let i = 0; i < Math.max(5, params.civs); i++) {
    const candidates = geography.tiles
      .map((t, j) => (!t.water ? j : -1))
      .filter((j) => j >= 0);
    world.creatures.push({
      id: `m${i}`,
      kind: "criatura",
      name: `${name(r, i)}, ${pick(r, ["a Sombra Antiga", "o Devorador", "a Chama Eterna"])}`,
      species: pick(r, ["dragão", "colosso", "rei morto-vivo"]),
      tile: pick(r, candidates),
    });
  }
  return world;
}

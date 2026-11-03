export interface Params {
  seed: string;
  size: number;
  years: number;
  civs: number;
  chaos: number;
}
export interface Tile {
  elevation: number;
  temperature: number;
  rain: number;
  biome: number;
  region: string;
  water: boolean;
  river: boolean;
  owner?: string;
}
export interface Region {
  id: string;
  name: string;
  kind: "região";
  tile: number;
}
export interface Geography {
  size: number;
  tiles: Tile[];
  regions: Region[];
}
export interface Culture {
  id: string;
  name: string;
  race: string;
  traits: string[];
  values: string[];
  preferred: number[];
  religion: string;
  god: string;
  style: number;
}
export interface Civ {
  id: string;
  kind: "civilização";
  name: string;
  culture: string;
  government: string;
  capital: string;
  population: number;
  resources: string[];
  relations: Record<string, string>;
  leader: string;
  color: string;
}
export interface Settlement {
  id: string;
  kind: "assentamento";
  name: string;
  civ: string;
  tile: number;
  population: number;
  founded: number;
  abandoned?: number;
}
export interface Person {
  id: string;
  kind: "pessoa";
  name: string;
  civ: string;
  culture: string;
  race: string;
  born: number;
  died?: number;
  cause?: string;
  parents: string[];
  children: string[];
  spouse?: string;
  role: string;
  traits: string[];
  ambition: string;
  relations: Record<string, string>;
  deeds: string[];
  possessions: string[];
}
export interface Creature {
  id: string;
  kind: "criatura";
  name: string;
  species: string;
  tile: number;
  slain?: number;
  slayer?: string;
}
export interface Event {
  id: string;
  year: number;
  type: string;
  participants: string[];
  location: string;
  consequences: string;
  cause?: string;
  variant: number;
}
export interface Artifact {
  id: string;
  kind: "artefato";
  name: string;
  creator: string;
  material: string;
  properties: string;
  created: number;
  owner?: string;
  destroyed?: number;
  provenance: {
    year: number;
    action: string;
    holder?: string;
    event: string;
  }[];
}
export interface World {
  version: 1;
  params: Params;
  geography: Geography;
  cultures: Culture[];
  civs: Civ[];
  settlements: Settlement[];
  people: Person[];
  creatures: Creature[];
  events: Event[];
  artifacts: Artifact[];
}
export type Entity = Region | Civ | Settlement | Person | Creature | Artifact;

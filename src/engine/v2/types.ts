import type { Life, Household, Pregnancy, LifeOptions } from "./life";
import type {
  Body,
  Part,
  Wound,
  PhysicalGoal,
  Duel,
  Kill,
  BodyOptions,
} from "./body";
import type { Psychology, Stimulus } from "./emotions";
import type { ProtectionEstimate } from "./protection";
export type Action =
  | "esperar"
  | "treinar"
  | "observar"
  | "confrontar"
  | "comunicar"
  | "perdoar"
  | "buscar_acordo"
  | "conviver"
  | "proteger"
  | "avisar_alvo"
  | "pedir_aliados"
  | "afastar_alvo"
  | "buscar_apoio"
  | "escrever_obra"
  | "isolar"
  | "hostilizar"
  | "abandonar_posto"
  | "recuperar";
export const outcomes = [
  "vingança cumprida",
  "desistência",
  "alvo morto por outra causa",
  "reconciliação",
  "fuga",
  "objetivo frustrado",
] as const;
export type Outcome = (typeof outcomes)[number];
export interface Person {
  hunger?: number;
  blockedWritingStock?: string;
  knownFactSources?: Record<string, string>;
  occupation?: import("./daily").Occupation;
  workedMonth?: number;
  id: string;
  kind: "person";
  name: string;
  born: number;
  lifeStage?: "child" | "youth" | "adult" | "elder";
  alive: boolean;
  death?: string;
  killer?: string;
  traits: {
    rancor: number;
    coragem: number;
    disciplina: number;
    cautela: number;
    [key: string]: number;
  };
  values: {
    familia: number;
    vinganca: number;
    paz: number;
    amizade?: number;
    solidariedade?: number;
    [key: string]: number | undefined;
  };
  skill: number;
  skills?: { lideranca: number; escrita: number };
  psychology?: Psychology;
  knownInjuries?: Record<string, string>;
  medicalSkill?: number;
  expelled?: string;
  pledge?: { to: string; source: string; until: number };
  supportFor?: string;
  works?: string[];
  kin: string[];
  rival?: string;
  hostility: number;
  trainAccess: boolean;
  canHelp: boolean;
  helpFrom?: string;
  helpedBy?: string;
  present: boolean;
  escaped: boolean;
  remorse: number;
  shelteredUntil?: number;
  knownThreats?: Record<string, string>;
  informed: string[];
  goal?: string;
  memory?: string;
  acquaintances?: Record<string, string>;
  bonds?: Record<
    string,
    { trust: number; interactions: number; source: string }
  >;
  personalGoals?: string[];
  lastBy: Record<string, string>;
}
export interface Memory {
  id: string;
  kind: "memory";
  owner: string;
  victim: string;
  offender: string;
  source: string;
  at: number;
  weight: number;
  offenderSkillEstimate: number;
  rancor: number;
}
export interface Goal {
  id: string;
  kind: "goal";
  owner: string;
  target: string;
  victim: string;
  offense: string;
  memory: string;
  adopted: number;
  closed?: number;
  outcome?: Outcome;
  source: string;
  accordIntent?: string;
  accordRejected?: string;
}
export interface PersonalGoal {
  id: string;
  kind: "personalGoal";
  type: "proteger" | "amizade" | "governar" | "criar_obra";
  owner: string;
  target: string;
  source: string;
  lastEvent: string;
  adopted: number;
  closed?: number;
  status?: "completed" | "failed" | "abandoned" | "resolved_by_other";
  reason?: string;
  threat?: string;
  perception?: string;
  aggressor?: string;
  threatResolved?: boolean;
  estimate?: ProtectionEstimate;
  progress?: number;
  workStarted?: string;
  knowledgeSource?: string;
  theme?: string;
  solicited?: Record<string, { month: number; event: string }>;
  lastMonitored?: string;
  interventions: number;
  rejections: number;
}
export interface Place {
  id: string;
  kind: "place";
  name: string;
  incidents?: Record<string, { threats: string[]; consequence?: string }>;
  leader?: string;
  leaderSource?: string;
  suppliesSource?: string;
  medical?: { bandages: number; tools: boolean };
  medicalSource?: string;
  supplies?: { paper: number; ink: number };
}
export interface Work {
  owner?: string;
  ownerSource?: string;
  ownerEstate?: boolean;
  knowledgeSource?: string;
  id: string;
  kind: "work";
  name: string;
  creator: string;
  goal: string;
  theme?: string;
  quality: number;
  source: string;
  created: number;
  material: "papel e tinta";
}
export type Entity =
  | Life
  | Household
  | Pregnancy
  | Person
  | Memory
  | Goal
  | PersonalGoal
  | Place
  | Work
  | Body
  | Part
  | Wound
  | PhysicalGoal
  | Duel
  | Kill;
export interface Candidate {
  action: Action;
  score: number;
  base: number;
  noise: number;
  factors: Record<string, number>;
  evidence: string[];
  target?: string;
}
export interface Decision {
  actor: string;
  chosen: Action;
  target?: string;
  reason: string;
  candidates: Candidate[];
}
export type Effect =
  { op: "create"; entity: Entity } | { op: "replace"; entity: Entity };
export interface SliceEvent {
  readonly id: string;
  readonly seq: number;
  readonly ano: number;
  readonly dia: number;
  readonly month: number;
  readonly type: string;
  readonly participants: readonly {
    id: string;
    role:
      "actor" | "target" | "victim" | "witness" | "reference" | "beneficiary";
  }[];
  readonly location: string;
  readonly causes: readonly string[];
  readonly effects: readonly Effect[];
  readonly data: Readonly<Record<string, unknown>>;
  readonly decision?: Decision;
}
export interface Schedule {
  id: string;
  from: number;
  until: number;
  period: number;
  absentMonths: number;
}
export interface Scenario {
  dailyLife?: import("./daily").DailyOptions;
  lifeSimulation?: LifeOptions;
  seed: string;
  mode: "free" | "fixture";
  months: number;
  people: Person[];
  schedules: Schedule[];
  focal: string;
  victim: string;
  offender: string;
  helper: string;
  blockedInformation: string[];
  noReencounter: boolean;
  externalDeathMonth?: number;
  personalObjectives?: boolean;
  advancedObjectives?: boolean;
  emotionalDynamics?: boolean;
  bodySimulation?: BodyOptions;
  fixtureLeader?: string;
  materials?: { paper: number; ink: number };
  friendTargets?: Record<string, string>;
  blockedThreatPerception?: string[];
}
export interface SliceWorld {
  version: 2;
  engine:
    | "revenge-slice-1"
    | "agents-slice-1a"
    | "agents-slice-1b"
    | "agents-slice-protection2"
    | "agents-slice-1c"
    | "agents-slice-1d"
    | "agents-slice-2a"
    | "agents-slice-2.1"
    | "agents-slice-2b"
    | "agents-slice-2c"
    | "agents-slice-2d1"
    | "agents-slice-2d1-emotion2"
    | "agents-slice-2d2";
  scenario: Scenario;
  events: SliceEvent[];
  entities: Record<string, Entity>;
  nextMonth: number;
  complete: boolean;
}
export interface Reaction {
  kind: "perceive" | "hear" | "help" | "settleDeath" | "threat" | "affect";
  stimulus?: Stimulus;
  source: string;
  recipient: string;
  sender?: string;
}

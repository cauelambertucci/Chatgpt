/** 2d-2: fictional monthly household units; no trade, teaching or reputation. */
export interface Stock {
  food: number;
  wood: number;
  fiber: number;
  pigment: number;
  tools: number;
}
export interface EconomyOptions {
  initial: Stock;
  harvest: number;
}
export const lightEconomy = (): EconomyOptions => ({
  initial: { food: 96, wood: 240, fiber: 240, pigment: 160, tools: 6 },
  harvest: 48,
});
export const foodNeed = (stage?: string) => (stage === "child" ? 2 : 4);
export function ration(stock: number, needs: number[]) {
  const total = needs.reduce((a, b) => a + b, 0),
    consumed = Math.min(stock, total);
  // Equal fractional coverage; no invisible priority or discarded rounding.
  return { consumed, coverage: total ? consumed / total : 1 };
}
export function hungerAfter(before: number, coverage: number) {
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(before + (1 - coverage) * 20 - (coverage === 1 ? 25 : 0)),
    ),
  );
}
export function recipe(stock: Stock, paper: number, ink: number) {
  if (stock.tools < 4 && stock.wood >= 2)
    return {
      item: "ferramentas",
      take: { wood: 2 },
      give: { tools: 2 },
      paper: 0,
      ink: 0,
    };
  if (paper < 6 && stock.fiber >= 3)
    return { item: "papel", take: { fiber: 3 }, give: {}, paper: 3, ink: 0 };
  if (ink < 4 && stock.pigment >= 2)
    return { item: "tinta", take: { pigment: 2 }, give: {}, paper: 0, ink: 2 };
  return undefined;
}

/** 12 months for the initial two-adult household; ramp starts well before shortage. */
export const reserveMonths = (food: number, demand: number) =>
  demand > 0 ? food / demand : Infinity;
export const cultivationNeed = (food: number, demand: number) =>
  Math.max(0, 12 - reserveMonths(food, demand)) * 180;
/** One tool lasts twelve worked months; manual cultivation remains slower but possible. */
export const toolLifetime = 12;
export const cultivationYield = (
  harvest: number,
  capacity: number,
  stress: number,
  hasTool: boolean,
) =>
  Math.floor(
    harvest * capacity * Math.max(0.6, 1 - stress / 2500) * (hasTool ? 1 : 0.6),
  );

import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { clubs } from "../src/data.js";
import { eliminationOrder, filterClubs } from "../src/engine.js";

// Runs the production algorithm with native Web Crypto; never replaces randomness.
const scenarios = [
  {
    name: "Liga Portugal",
    pool: filterClubs(clubs, {
      country: "Portugal",
      league: ["Liga Portugal"],
    }),
    draws: 120000,
  },
  {
    name: "Liga Portugal — ordem invertida",
    pool: filterClubs(clubs, { country: "Portugal" }).reverse(),
    draws: 120000,
  },
  ...[...new Set(clubs.map((c) => c.country))]
    .filter((c) => c !== "Portugal")
    .map((country) => ({
      name: country,
      pool: filterClubs(clubs, { country }),
      draws: 24000,
    })),
  { name: "Todos os clubes", pool: clubs, draws: 54000 },
  {
    name: "Shortlist personalizada",
    pool: [clubs[0], clubs[7], clubs[19], clubs[35], clubs[80]],
    draws: 30000,
  },
];
const results = [];
for (const scenario of scenarios) {
  const counts = new Map(scenario.pool.map((c) => [c.id, 0]));
  const positions = Array.from(
    { length: scenario.pool.length },
    () => new Map(scenario.pool.map((c) => [c.id, 0])),
  );
  let repeated = 0,
    previous = null;
  for (let run = 0; run < scenario.draws; run++) {
    const order = eliminationOrder(scenario.pool);
    const winner = order.at(-1);
    counts.set(winner.id, counts.get(winner.id) + 1);
    if (previous === winner.id) repeated++;
    previous = winner.id;
    for (let position = 0; position < order.length; position++)
      positions[position].set(
        order[position].id,
        positions[position].get(order[position].id) + 1,
      );
  }
  const expected = scenario.draws / scenario.pool.length;
  const standardDeviation = Math.sqrt(
    scenario.draws *
      (1 / scenario.pool.length) *
      (1 - 1 / scenario.pool.length),
  );
  const maxWinnerDeviation = Math.max(
    ...[...counts.values()].map(
      (count) => Math.abs(count - expected) / standardDeviation,
    ),
  );
  const maxPositionDeviation = Math.max(
    ...positions.map((position) =>
      Math.max(
        ...[...position.values()].map(
          (count) => Math.abs(count - expected) / standardDeviation,
        ),
      ),
    ),
  );
  // Broad diagnostic threshold, not proof of randomness. Do not rebalance outcomes.
  const noExtremeDeviation = maxWinnerDeviation < 7 && maxPositionDeviation < 7;
  const result = {
    name: scenario.name,
    clubs: scenario.pool.length,
    draws: scenario.draws,
    expectedPercent: 100 / scenario.pool.length,
    winners: scenario.pool.map((c) => ({
      name: c.name,
      wins: counts.get(c.id),
      percent: (100 * counts.get(c.id)) / scenario.draws,
    })),
    maxWinnerDeviationSigma: maxWinnerDeviation,
    maxPositionDeviationSigma: maxPositionDeviation,
    repeatedWinners: repeated,
    noExtremeDeviation,
  };
  results.push(result);
  console.log(
    `${scenario.name}: ${scenario.draws} sorteios, ${scenario.pool.length} clubes, maior desvio nas vitórias ${maxWinnerDeviation.toFixed(2)}σ; em qualquer posição ${maxPositionDeviation.toFixed(2)}σ; repetições consecutivas ${repeated}.`,
  );
}
const report = {
  generatedAt: new Date().toISOString(),
  algorithm:
    "Production Fisher–Yates + native crypto.getRandomValues + rejection sampling",
  totalDraws: results.reduce((sum, r) => sum + r.draws, 0),
  note: "A simulation is diagnostic evidence, not a proof of fairness. Independent draws may repeat winners. No history, name, reputation or balancing weights are used.",
  results,
};
if (process.argv[2])
  await writeFile(process.argv[2], JSON.stringify(report, null, 2) + "\n");
assert.ok(
  results.every((r) => r.noExtremeDeviation),
  "Extreme deviation: investigate before changing the algorithm.",
);
console.log(
  `TOTAL: ${report.totalDraws} sorteios; ${results.length} cenários sem desvios extremos.`,
);

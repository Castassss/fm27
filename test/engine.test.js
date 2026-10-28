import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterClubs,
  choose,
  validateImport,
  eliminationOrder,
} from "../src/engine.js";
const clubs = [
  { id: "a", name: "FC Porto", country: "Portugal", league: "Liga Portugal" },
  { id: "b", name: "Arsenal", country: "Inglaterra", league: "Premier League" },
  { id: "c", name: "SL Benfica", country: "Portugal", league: "Liga Portugal" },
];
test("combines filters, shortlist and exclusions", () => {
  assert.deepEqual(
    filterClubs(clubs, {
      country: "Portugal",
      shortlistOnly: true,
      shortlist: ["a", "b", "c"],
      excluded: ["c"],
    }),
    [clubs[0]],
  );
  assert.deepEqual(filterClubs(clubs, { query: "ARSENAL" }), [clubs[1]]);
  assert.equal(
    filterClubs(clubs, { country: "Portugal", league: "Premier League" })
      .length,
    0,
  );
});
test("draw rejects out-of-range values rather than introducing modulo bias", () => {
  let calls = 0;
  const rng = {
    getRandomValues(a) {
      a[0] = calls++ === 0 ? 4294967295 : 4;
    },
  };
  assert.equal(choose(clubs, rng).id, "b");
  assert.equal(calls, 2);
  assert.throws(() => choose([]));
});
test("import validates required fields and duplicates, treats data as unverified", () => {
  assert.throws(() => validateImport({}));
  assert.throws(() => validateImport([{ name: "A" }]));
  assert.throws(() => validateImport([clubs[0], clubs[0]]));
  const data = validateImport(clubs);
  assert.equal(data.length, 3);
  assert.equal(data[0].verified, false);
  assert.equal(data[0].name, "FC Porto");
});

test("multiple leagues can participate in the same draw", () => {
  assert.equal(
    filterClubs(clubs, { league: ["Liga Portugal", "Premier League"] }).length,
    3,
  );
  assert.equal(filterClubs(clubs, { league: ["Premier League"] }).length, 1);
});

test("elimination order preserves every entrant once without mutating the pool", () => {
  const order = eliminationOrder(clubs, {
    getRandomValues(a) {
      a[0] = 0;
    },
  });
  assert.deepEqual(
    clubs.map((c) => c.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    [...order].sort((a, b) => a.id.localeCompare(b.id)),
    clubs,
  );
  assert.equal(new Set(order.map((c) => c.id)).size, 3);
  assert.notDeepEqual(order, clubs);
  assert.throws(() => eliminationOrder([]));
  assert.throws(() => eliminationOrder([clubs[0]]));
});
test("every three-club elimination permutation is reachable", () => {
  const orders = new Set();
  for (let a = 0; a < 3; a++)
    for (let b = 0; b < 2; b++) {
      const values = [a, b];
      const order = eliminationOrder(clubs, {
        getRandomValues(array) {
          array[0] = values.shift();
        },
      });
      orders.add(order.map((c) => c.id).join(""));
    }
  assert.equal(orders.size, 6);
});

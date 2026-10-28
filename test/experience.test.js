import { test } from "node:test";
import assert from "node:assert/strict";
import { clubs } from "../src/data.js";
import {
  candidatesFor,
  restoreSelection,
  selectionSnapshot,
  probabilityLabel,
} from "../src/experience.js";

test("journeys define explicit pools without weighting individual clubs", () => {
  const europe = candidatesFor(clubs, { journey: "europe" }),
    elsewhere = candidatesFor(clubs, { journey: "elsewhere" });
  assert.equal(europe.length + elsewhere.length, clubs.length);
  assert.equal(
    new Set([...europe, ...elsewhere].map((c) => c.id)).size,
    clubs.length,
  );
  assert.equal(candidatesFor(clubs, { journey: "world" }).length, 108);
  assert.equal(
    candidatesFor(clubs, { journey: "europe", countries: ["Portugal"] }).length,
    12,
  );
});
test("countries, multiple leagues, favourites and exclusions compose consistently", () => {
  const selection = {
    journey: "shortlist",
    countries: ["Portugal", "Inglaterra"],
    leagues: ["Liga Portugal", "Premier League"],
    shortlist: ["Portugal-0", "Portugal-1", "Inglaterra-0", "Espanha-0"],
    excluded: ["Portugal-1"],
  };
  assert.deepEqual(
    candidatesFor(clubs, selection).map((c) => c.id),
    ["Portugal-0", "Inglaterra-0"],
  );
});
test("saving and restoring selection preserves the exact entrant pool and challenge", () => {
  const original = {
    journey: "europe",
    countries: ["Portugal"],
    leagues: ["Liga Portugal"],
    shortlist: ["Portugal-0"],
    excluded: ["Portugal-1"],
    challenge: "academy",
  };
  const snapshot = selectionSnapshot(original),
    restored = restoreSelection(JSON.parse(JSON.stringify(snapshot)));
  assert.deepEqual(
    candidatesFor(clubs, restored),
    candidatesFor(clubs, original),
  );
  assert.equal(restored.challenge, "academy");
  snapshot.countries.push("Inglaterra");
  assert.deepEqual(original.countries, ["Portugal"]);
});
test("imported countries are not silently misclassified by regional journeys", () => {
  const imported = [
    { id: "a", name: "One", country: "Unknown", league: "Test" },
  ];
  assert.equal(candidatesFor(imported, { journey: "world" }).length, 1);
  assert.equal(candidatesFor(imported, { journey: "europe" }).length, 0);
  assert.equal(candidatesFor(imported, { journey: "elsewhere" }).length, 0);
});
test("stored selections validate arrays and fall back for unknown preset identifiers", () => {
  assert.throws(() => restoreSelection({ shortlist: "everyone" }));
  assert.throws(() => restoreSelection({ countries: [null] }));
  assert.equal(
    restoreSelection({ journey: "unknown", challenge: "unknown" }).journey,
    "world",
  );
  assert.equal(restoreSelection({}).challenge, "free");
  assert.equal(probabilityLabel(12), "8,33%");
  assert.equal(probabilityLabel(50000), "0,002%");
  assert.equal(probabilityLabel(0), "0%");
});

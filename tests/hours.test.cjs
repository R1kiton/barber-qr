/* eslint-disable @typescript-eslint/no-require-imports -- Load pure TS modules without adding a test framework. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};
const { availableSlots } = require("../src/lib/slots.ts");
const { hoursForDay, formatSchedule, isWeeklyHours } = require("../src/lib/hours.ts");
const shop = {
  id: "test", openTime: "09:00", closeTime: "20:00", workDays: [1, 2, 3, 4, 5, 6],
  services: [{ id: "cut", durationMin: 60 }], barbers: [{ id: "barber" }],
};
const now = new Date(2026, 10, 13, 8);
const slots = (schedule, date) => availableSlots(schedule, [], date, "cut", "any", now);

test("existing schedules retain their availability", () => {
  assert.equal(slots(shop, "2026-11-14").at(-1), "19:00");
  assert.deepEqual(slots(shop, "2026-11-15"), []);
});

test("Saturday uses its shorter range, including full service duration", () => {
  const weeklyHours = Array.from({ length: 7 }, (_, day) => hoursForDay(shop, day));
  weeklyHours[6] = { openTime: "10:00", closeTime: "14:00" };
  const flexible = { ...shop, weeklyHours };
  assert.equal(slots(flexible, "2026-11-14")[0], "10:00");
  assert.equal(slots(flexible, "2026-11-14").at(-1), "13:00");
  assert.equal(slots(flexible, "2026-11-16").at(-1), "19:00");
  assert.deepEqual(slots(flexible, "2026-11-15"), []);
  assert.match(formatSchedule(flexible), /10:00–14:00/);
  assert.match(formatSchedule(flexible), /09:00–20:00/);
});

test("explicit closed days override legacy work days, including a fully closed week", () => {
  const closed = { ...shop, weeklyHours: Array(7).fill(null) };
  assert.deepEqual(slots(closed, "2026-11-14"), []);
  assert.equal(formatSchedule(closed), "Cerrado toda la semana");
});

test("weekly schedule rejects malformed times and reversed ranges", () => {
  assert.equal(isWeeklyHours(Array(7).fill(null)), true);
  assert.equal(isWeeklyHours([]), false);
  for (const day of [{ openTime: "20:00", closeTime: "09:00" }, { openTime: "25:00", closeTime: "26:00" }, {}]) {
    assert.equal(isWeeklyHours([day, ...Array(6).fill(null)]), false);
  }
});

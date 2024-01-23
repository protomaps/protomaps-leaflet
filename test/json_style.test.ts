import assert from "assert";
import { test } from "node:test";
import {
  filterFn,
  getFont,
  numberFn,
  numberOrFn,
} from "../src/compat/json_style";
import { Filter } from "../src/painter";
import { GeomType } from "../src/tilecache";

export const emptyFeature = {
  props: {},
  geomType: GeomType.Point,
  numVertices: 0,
  geom: [],
  bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
};

let f: Filter | undefined;

test("==", async () => {
  f = filterFn(["==", "building", "yes"]);
  assert(f(0, { ...emptyFeature, props: { building: "yes" } }));
});
test("!=", async () => {
  f = filterFn(["!=", "building", "yes"]);
  assert(!f(0, { ...emptyFeature, props: { building: "yes" } }));
  assert(f(0, { ...emptyFeature, props: { building: "no" } }));
});
test("<", async () => {
  f = filterFn(["<", "level", 3]);
  assert(f(0, { ...emptyFeature, props: { level: 2 } }));
  assert(!f(0, { ...emptyFeature, props: { level: 3 } }));
});
test("<=", async () => {
  f = filterFn(["<=", "level", 3]);
  assert(f(0, { ...emptyFeature, props: { level: 2 } }));
  assert(f(0, { ...emptyFeature, props: { level: 3 } }));
});
test(">", async () => {
  f = filterFn([">", "level", 3]);
  assert(f(0, { ...emptyFeature, props: { level: 4 } }));
  assert(!f(0, { ...emptyFeature, props: { level: 3 } }));
});
test(">=", async () => {
  f = filterFn([">=", "level", 3]);
  assert(f(0, { ...emptyFeature, props: { level: 4 } }));
  assert(f(0, { ...emptyFeature, props: { level: 3 } }));
});
test("in", async () => {
  f = filterFn(["in", "type", "foo", "bar"]);
  assert(f(0, { ...emptyFeature, props: { type: "foo" } }));
  assert(f(0, { ...emptyFeature, props: { type: "bar" } }));
  assert(!f(0, { ...emptyFeature, props: { type: "baz" } }));
});
test("!in", async () => {
  f = filterFn(["!in", "type", "foo", "bar"]);
  assert(!f(0, { ...emptyFeature, props: { type: "bar" } }));
  assert(f(0, { ...emptyFeature, props: { type: "baz" } }));
});
test("has", async () => {
  f = filterFn(["has", "type"]);
  assert(f(0, { ...emptyFeature, props: { type: "foo" } }));
  assert(!f(0, { ...emptyFeature, props: {} }));
});
test("!has", async () => {
  f = filterFn(["!has", "type"]);
  assert(!f(0, { ...emptyFeature, props: { type: "foo" } }));
  assert(f(0, { ...emptyFeature, props: {} }));
});
test("!", async () => {
  f = filterFn(["!", ["has", "type"]]);
  assert(!f(0, { ...emptyFeature, props: { type: "foo" } }));
  assert(f(0, { ...emptyFeature, props: {} }));
});
test("all", async () => {
  f = filterFn(["all", ["==", "building", "yes"], ["==", "type", "foo"]]);
  assert(!f(0, { ...emptyFeature, props: { building: "yes" } }));
  assert(!f(0, { ...emptyFeature, props: { type: "foo" } }));
  assert(f(0, { ...emptyFeature, props: { building: "yes", type: "foo" } }));
});
test("any", async () => {
  f = filterFn(["any", ["==", "building", "yes"], ["==", "type", "foo"]]);
  assert(!f(0, { ...emptyFeature, props: {} }));
  assert(f(0, { ...emptyFeature, props: { building: "yes" } }));
  assert(f(0, { ...emptyFeature, props: { type: "foo" } }));
  assert(f(0, { ...emptyFeature, props: { building: "yes", type: "foo" } }));
});

test("numberFn constant", async () => {
  let n = numberOrFn(5);
  assert.equal(n, 5);
  n = numberOrFn(undefined);
  assert.equal(n, 0);
});

test("numberFn function", async () => {
  let n = numberFn({
    base: 1,
    stops: [
      [14, 0],
      [16, 2],
    ],
  });
  assert.equal(n.length, 1);
  assert.equal(n(15), 0);
  assert.equal(n(16), 1);
  assert.equal(n(17), 2);
});

test("numberFn interpolate", async () => {
  let n = numberFn(["interpolate", ["exponential", 1], ["zoom"], 14, 0, 16, 2]);
  assert.equal(n.length, 1);
  assert.equal(n(15), 0);
  assert.equal(n(16), 1);
  assert.equal(n(17), 2);
});

test("numberFn properties", async () => {
  let n = numberFn(["step", ["get", "scalerank"], 0, 1, 2, 3, 4]);
  assert.equal(n.length, 2);
  assert.equal(n(14, { ...emptyFeature, props: { scalerank: 0 } }), 0);
  assert.equal(n(14, { ...emptyFeature, props: { scalerank: 1 } }), 2);
  assert.equal(n(14, { ...emptyFeature, props: { scalerank: 3 } }), 4);
  assert.equal(n(14, { ...emptyFeature, props: { scalerank: 4 } }), 4);
});

test("font", async () => {
  let n = getFont({ "text-font": ["Noto"], "text-size": 14 }, {});
  assert.equal(n(1), "14px sans-serif");

  n = getFont({ "text-font": ["Noto"], "text-size": 15 }, {});
  assert.equal(n(1), "15px sans-serif");

  n = getFont(
    { "text-font": ["Noto"], "text-size": 15 },
    { Noto: { face: "serif" } }
  );
  assert.equal(n(1), "15px serif");

  n = getFont(
    { "text-font": ["Boto", "Noto"], "text-size": 15 },
    { Noto: { face: "serif" }, Boto: { face: "Comic Sans" } }
  );
  assert.equal(n(1), "15px Comic Sans, serif");
});

test("font weight and style", async () => {
  let n = getFont(
    { "text-font": ["Noto"], "text-size": 15 },
    { Noto: { face: "serif", weight: 100 } }
  );
  assert.equal(n(1), "100 15px serif");
  n = getFont(
    { "text-font": ["Noto"], "text-size": 15 },
    { Noto: { face: "serif", style: "italic" } }
  );
  assert.equal(n(1), "italic 15px serif");
});

test("font size fn zoom", async () => {
  let n = getFont(
    {
      "text-font": ["Noto"],
      "text-size": {
        base: 1,
        stops: [
          [14, 1],
          [16, 3],
        ],
      },
    },
    {}
  );
  assert.equal(n(15), "1px sans-serif");
  assert.equal(n(16), "2px sans-serif");
  assert.equal(n(17), "3px sans-serif");
});

test("font size fn zoom props", async () => {
  let n = getFont(
    {
      "text-font": ["Noto"],
      "text-size": ["step", ["get", "scalerank"], 0, 1, 12, 2, 10],
    },
    {}
  );
  assert.equal(
    n(14, { ...emptyFeature, props: { scalerank: 0 } }),
    "0px sans-serif"
  );
  assert.equal(
    n(14, { ...emptyFeature, props: { scalerank: 1 } }),
    "12px sans-serif"
  );
  assert.equal(
    n(14, { ...emptyFeature, props: { scalerank: 2 } }),
    "10px sans-serif"
  );
});

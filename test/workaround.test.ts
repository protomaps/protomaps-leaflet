import assert from "assert";
import baretest from "baretest";
import { splitMultiLineString, splitMultiPolygon } from "../src/workaround";

test = baretest("Static");

test("lines", async () => {
  let mls = [
    [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
      { x: 30, y: 30 },
    ],
    [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
    ],
    [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
  ];
  let result = splitMultiLineString(mls, 6);
  assert.equal(result.length, 2);
  assert.equal(result[0].length, 1);
  assert.equal(result[1].length, 2);
});

test("polygons", async () => {
  let mp = [
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 0 },
    ], // outer ring (clockwise)
    [
      { x: 20, y: 20 },
      { x: 20, y: 80 },
      { x: 80, y: 80 },
      { x: 80, y: 20 },
      { x: 20, y: 20 },
    ], // inner ring (counterclockwise)
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 0 },
    ], // outer ring (clockwise)
  ];
  let result = splitMultiPolygon(mp, 6);
  assert.equal(result.length, 2);
  assert.equal(result[0].length, 2);
  assert.equal(result[1].length, 1);
});

export default test;

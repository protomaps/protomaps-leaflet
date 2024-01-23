import assert from "assert";
import { test } from "node:test";
import {
  isCCW,
  isInRing,
  pointInPolygon,
  pointMinDistToLines,
  pointMinDistToPoints,
} from "../src/tilecache";

test("basic", async () => {
  // cache.get({z:0,x:0,y:0}).then(f => {
  //     console.log(f)
  // })
});

test("point to point", async () => {
  assert.equal(
    pointMinDistToPoints({ x: 0, y: 0 }, [[{ x: 8, y: 0 }], [{ x: 4, y: 0 }]]),
    4
  );
});

test("point to line", async () => {
  assert.equal(
    pointMinDistToLines({ x: 0, y: 4 }, [
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    ]),
    4
  );
});

test("is in ring", async () => {
  assert.equal(
    true,
    isInRing({ x: 5, y: 5 }, [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 },
    ])
  );

  // works for CCW
  assert.equal(
    true,
    isInRing({ x: 5, y: 5 }, [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 0 },
    ])
  );
});

test("is ccw", async () => {
  assert.equal(
    false,
    isCCW([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 },
    ])
  );
  assert.equal(
    true,
    isCCW([
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 0 },
    ])
  );
});

test("point in polygon", async () => {
  // simple case
  assert.equal(
    true,
    pointInPolygon({ x: 5, y: 5 }, [
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 0 },
      ],
    ])
  );

  // multiple exterior rings
  assert.equal(
    true,
    pointInPolygon({ x: 25, y: 25 }, [
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 0 },
      ],
      [
        { x: 20, y: 20 },
        { x: 30, y: 20 },
        { x: 30, y: 30 },
        { x: 20, y: 30 },
        { x: 20, y: 20 },
      ],
    ])
  );

  // simple case with holes
  assert.equal(
    false,
    pointInPolygon({ x: 5, y: 5 }, [
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 0 },
      ],
      [
        { x: 7, y: 7 },
        { x: 7, y: 3 },
        { x: 3, y: 3 },
        { x: 3, y: 7 },
        { x: 7, y: 7 },
      ],
    ])
  );
});

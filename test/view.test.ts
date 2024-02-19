import assert from "assert";
import { test } from "node:test";
import Point from "@mapbox/point-geometry";
import { TileCache } from "../src/tilecache";
import { View, sourcesToViews, wrap } from "../src/view";
import { StubSource } from "./test_helpers";

const cache = new TileCache(new StubSource(), 1024);

test("basic, level diff = 0", async () => {
  const view = new View(cache, 3, 0);
  let result = view.dataTileForDisplayTile({ z: 3, x: 4, y: 1 });
  assert.deepEqual(result.dataTile, { z: 3, x: 4, y: 1 });
  assert.equal(result.scale, 1);
  assert.deepEqual(result.origin, new Point(256 * 4, 256 * 1));
  assert.equal(result.dim, 1024);

  result = view.dataTileForDisplayTile({ z: 4, x: 4, y: 2 });
  assert.deepEqual(result.dataTile, { z: 3, x: 2, y: 1 });
  assert.equal(result.scale, 2);
  assert.deepEqual(result.origin, new Point(256 * 4, 256 * 2));
  assert.equal(result.dim, 2048);
});

test("level diff = 1", async () => {
  const view = new View(cache, 3, 1);
  let result = view.dataTileForDisplayTile({ z: 3, x: 4, y: 1 });
  assert.deepEqual(result.dataTile, { z: 2, x: 2, y: 0 });
  assert.equal(result.scale, 1);
  assert.deepEqual(result.origin, new Point(256 * 4, 256 * 0));
  assert.equal(result.dim, 1024);

  result = view.dataTileForDisplayTile({ z: 1, x: 0, y: 0 });
  assert.deepEqual(result.dataTile, { z: 0, x: 0, y: 0 });
  assert.equal(result.scale, 1);
  assert.deepEqual(result.origin, new Point(256 * 0, 256 * 0));

  result = view.dataTileForDisplayTile({ z: 0, x: 0, y: 0 });
  assert.deepEqual(result.dataTile, { z: 0, x: 0, y: 0 });
  assert.equal(result.scale, 0.5);
  assert.deepEqual(result.origin, new Point(256 * 0, 256 * 0));
  assert.equal(result.dim, 512);
});

test("level diff = 2", async () => {
  const view = new View(cache, 3, 2);
  const result = view.dataTileForDisplayTile({ z: 6, x: 9, y: 13 });
  assert.deepEqual(result.dataTile, { z: 3, x: 1, y: 1 });
  assert.equal(result.scale, 2);
  assert.deepEqual(result.origin, new Point(256 * 8, 256 * 8));
});

test("get center no level diff", async () => {
  const view = new View(cache, 3, 0);
  const result = view.dataTilesForBounds(3, {
    minX: 100,
    minY: 100,
    maxX: 400,
    maxY: 400,
  });
  assert.equal(result.length, 4);
});

test("get center level diff = 2", async () => {
  const view = new View(cache, 3, 2);
  const result = view.dataTilesForBounds(6, {
    minX: 100,
    minY: 100,
    maxX: 400,
    maxY: 400,
  });
  assert.equal(result.length, 1);
});

test("wrap tile coordinates", async () => {
  const view = new View(cache, 3, 2);
  const result = view.dataTilesForBounds(6, {
    minX: -100,
    minY: 100,
    maxX: 400,
    maxY: 400,
  });
  assert.equal(result.length, 2);
  assert.deepEqual(result[0].dataTile, { z: 3, x: 7, y: 0 });
  assert.deepEqual(result[1].dataTile, { z: 3, x: 0, y: 0 });
});

test("wrap", async () => {
  assert.equal(wrap(-1, 3), 7);
  assert.equal(wrap(8, 3), 0);
});

test("sources to views", async () => {
  let v = sourcesToViews({ url: "http://example.com/{z}/{x}/{y}.mvt" });
  assert.equal(v.get("").levelDiff, 1);
  v = sourcesToViews({
    sources: {
      source1: {
        url: "http://example.com/{z}/{x}/{y}.mvt",
      },
    },
  });
  assert.equal(v.get("source1").levelDiff, 1);
});

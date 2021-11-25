import Point from "@mapbox/point-geometry";
import { covering, Index } from "../src/labeler";
import assert from "assert";
import baretest from "baretest";

let test = baretest("labeler");

test("covering", async () => {
  let result = covering(3, 1024, {
    minX: 256,
    minY: 256 * 2,
    maxX: 256 + 1,
    maxY: 256 * 2 + 1,
  });
  assert.deepEqual(result, [{ display: "1:2:3", key: "0:0:1" }]);
});

test("covering with antimeridian crossing", async () => {
  let result = covering(3, 1024, {
    minX: 2000,
    minY: 256 * 2,
    maxX: 2050,
    maxY: 256 * 2 + 1,
  });
  assert.deepEqual(result, [
    { display: "7:2:3", key: "1:0:1" },
    { display: "0:2:3", key: "0:0:1" },
  ]);
});

test("inserting label into index", async () => {
  let index = new Index(1024);
  index.insert(
    {
      anchor: new Point(100, 100),
      bboxes: [{ minX: 100, minY: 100, maxX: 200, maxY: 200 }],
      draw: (c) => {},
    },
    1,
    "abcd"
  );
  let result = index.searchBbox(
    { minX: 90, maxX: 110, minY: 90, maxY: 110 },
    Infinity
  );
  assert.equal(result.size, 1);
});

test("inserting label with antimeridian wrapping", async () => {
  let index = new Index(1024);
  index.insert(
    {
      anchor: new Point(1000, 100),
      bboxes: [{ minX: 1000, minY: 100, maxX: 1050, maxY: 200 }],
      draw: (c) => {},
    },
    1,
    "abcd"
  );
  let result = index.searchBbox(
    { minX: 0, maxX: 100, minY: 90, maxY: 110 },
    Infinity
  );
  assert.equal(result.size, 1);

  index = new Index(1024);
  index.insert(
    {
      anchor: new Point(-100, 100),
      bboxes: [{ minX: -100, minY: 100, maxX: 100, maxY: 200 }],
      draw: (c) => {},
    },
    1,
    "abcd"
  );
  result = index.searchBbox(
    { minX: 1000, maxX: 1024, minY: 90, maxY: 110 },
    Infinity
  );
  assert.equal(result.size, 1);
});

test("label with multiple bboxes", async () => {
  let index = new Index(1024);
  index.insert(
    {
      anchor: new Point(100, 100),
      bboxes: [
        { minX: 100, minY: 100, maxX: 110, maxY: 200 },
        { minX: 110, minY: 100, maxX: 120, maxY: 200 },
      ],
      draw: (c) => {},
    },
    1,
    "abcd"
  );
  let result = index.searchBbox(
    { minX: 90, maxX: 130, minY: 90, maxY: 110 },
    Infinity
  );
  assert.equal(result.size, 1);
});

test("label order", async () => {
  let index = new Index(1024);
  index.insert(
    {
      anchor: new Point(100, 100),
      bboxes: [{ minX: 100, minY: 100, maxX: 200, maxY: 200 }],
      draw: (c) => {},
    },
    2,
    "abcd"
  );
  let result = index.searchBbox(
    { minX: 90, maxX: 110, minY: 90, maxY: 110 },
    1
  );
  assert.equal(result.size, 0);
  result = index.searchBbox({ minX: 90, maxX: 110, minY: 90, maxY: 110 }, 3);
  assert.equal(result.size, 1);
});

test("pruning", async () => {
  let index = new Index(1024);
  index.insert(
    {
      anchor: new Point(100, 100),
      bboxes: [{ minX: 100, minY: 100, maxX: 200, maxY: 200 }],
      draw: (c) => {},
    },
    1,
    "abcd"
  );
  assert.equal(index.tree.all().length, 1);
  assert.equal(index.current.has("abcd"), true);
  index.pruneKey("abcd");
  assert.equal(index.current.size, 0);
  assert.equal(index.tree.all().length, 0);
});

test("remove an individual label", async () => {
  let index = new Index(1024);
  index.insert(
    {
      anchor: new Point(100, 100),
      bboxes: [{ minX: 100, minY: 100, maxX: 200, maxY: 200 }],
      draw: (c) => {},
    },
    1,
    "abcd"
  );
  assert.equal(index.tree.all().length, 1);
  assert.equal(index.current.get("abcd").size, 1);
  let the_label = index.tree.all()[0].indexed_label;
  index.removeLabel(the_label);
  assert.equal(index.current.size, 1);
  assert.equal(index.current.get("abcd").size, 0);
  assert.equal(index.tree.all().length, 0);
});

test("basic label deduplication", async () => {
  let index = new Index(1024);
  let label1 = {
    anchor: new Point(100, 100),
    bboxes: [{ minX: 100, minY: 100, maxX: 110, maxY: 110 }],
    draw: (c) => {},
    deduplicationKey: "Mulholland Dr.",
    deduplicationDistance: 100,
  };
  index.insert(label1, 1, "abcd");

  let repeated_label = {
    anchor: new Point(200, 100),
    bboxes: [{ minX: 200, minY: 100, maxX: 210, maxY: 110 }],
    draw: (c) => {},
    deduplicationKey: "Mulholland Dr.",
    deduplicationDistance: 100,
  };

  assert.equal(index.deduplicationCollides(repeated_label), false);

  let tooclose_label = {
    anchor: new Point(199, 100),
    bboxes: [{ minX: 199, minY: 100, maxX: 210, maxY: 110 }],
    draw: (c) => {},
    deduplicationKey: "Mulholland Dr.",
    deduplicationDistance: 100,
  };

  assert.equal(index.deduplicationCollides(tooclose_label), true);
});

export default test;

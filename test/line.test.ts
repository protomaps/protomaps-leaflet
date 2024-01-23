import assert from "assert";
import { test } from "node:test";

import { lineCells, simpleLabel } from "../src/line";

test("simple line labeler", async () => {
  const mls = [
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
  ];
  const results = simpleLabel(mls, 10, 250, 0);
  assert.deepEqual(results[0].start, { x: 0, y: 0 });
  assert.deepEqual(results[0].end, { x: 10, y: 0 });
});

test("simple line labeler tolerance", async () => {
  const mls = [
    [
      { x: 0, y: 0 },
      { x: 20, y: 0.5 },
      { x: 150, y: 0 },
    ],
  ];
  const results = simpleLabel(mls, 100, 250, 0);
  assert.equal(results.length, 1);
  assert.deepEqual(results[0].start, { x: 0, y: 0 });
  assert.equal(results[0].end.x > 99, true);
  assert.equal(results[0].end.x < 100, true);
});

test("simple line labeler - very gradual angles - multiple labels", async () => {
  const mls = [
    [
      { x: 0, y: 0 },
      { x: 10, y: 0.5 }, // about 2 degrees
      { x: 20, y: 1.5 },
      { x: 30, y: 3.0 },
    ],
  ];
  const results = simpleLabel(mls, 10, 250, 0);
  assert.equal(results.length, 3);
});

test("simple line labeler - one candidate, multiple labels based on repeatDistance", async () => {
  const mls = [
    [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
    ],
  ];
  const results = simpleLabel(mls, 100, 250, 0);
  assert.equal(results.length, 2);
  assert.deepEqual(results[0].start, { x: 0, y: 0 });
  assert.deepEqual(results[0].end, { x: 100, y: 0 });
  assert.deepEqual(results[1].start, { x: 250, y: 0 });
  assert.deepEqual(results[1].end, { x: 350, y: 0 });
});

test("too small", async () => {
  const mls = [
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
  ];
  const results = simpleLabel(mls, 20, 250, 0);
  assert.equal(results.length, 0);
});

test("line cells", async () => {
  const result = lineCells({ x: 0, y: 0 }, { x: 100, y: 0 }, 20, 5);
  assert.deepEqual(result, [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
  ]);
});

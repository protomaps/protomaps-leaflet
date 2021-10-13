import assert from "assert";
import baretest from "baretest";
import { lineCells, simpleLabel } from "../src/line";

test = baretest("Lines");

test("simple line labeler", async () => {
  let mls = [
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
  ];
  let results = simpleLabel(mls, 10, 250);
  assert.deepEqual(results[0].start, { x: 0, y: 0 });
  assert.deepEqual(results[0].end, { x: 10, y: 0 });
})


test("simple line labeler tolerance", async () => {
  mls = [
    [
      { x: 0, y: 0 },
      { x: 20, y: 0.5 },
      { x: 150, y: 0 },
    ],
  ];
  results = simpleLabel(mls, 100, 250);
  assert.equal(results.length, 1);
  assert.deepEqual(results[0].start, { x: 0, y: 0 });
  assert.equal(results[0].end.x > 99, true);
  assert.equal(results[0].end.x < 100, true);
});

test("simple line labeler - one candidate, multiple labels based on repeatDistance", async () => {
  let mls = [
    [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
    ],
  ];
  let results = simpleLabel(mls, 100, 250);
  assert.equal(results.length, 2);
  assert.deepEqual(results[0].start, { x: 0, y: 0 });
  assert.deepEqual(results[0].end, { x: 100, y: 0 });
  assert.deepEqual(results[1].start, { x: 250, y: 0 });
  assert.deepEqual(results[1].end, { x: 350, y: 0 });
});

test("too small", async () => {
  let mls = [
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
  ];
  let results = simpleLabel(mls, 20, 250);
  assert.equal(results.length, 0);
});

test("line cells", async () => {
  let result = lineCells({ x: 0, y: 0 }, { x: 100, y: 0 }, 20, 5);
  assert.deepEqual(result, [
    { x: 5, y: 0 },
    { x: 15, y: 0 },
  ]);
});

export default test;

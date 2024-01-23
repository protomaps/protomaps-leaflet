import { exp, step, linear, cubicBezier } from "../src/symbolizer";
import assert from "assert";
import { test } from "node:test";

test("exp", async () => {
  let result = exp(1.4, [])(5);
  assert.equal(result, 0);
  result = exp(1.4, [
    [5, 1.5],
    [11, 4],
    [16, 30],
  ])(5);
  assert.equal(result, 1.5);
  result = exp(1.4, [
    [5, 1.5],
    [11, 4],
    [16, 30],
  ])(11);
  assert.equal(result, 4);
  result = exp(1.4, [
    [5, 1.5],
    [11, 4],
    [16, 30],
  ])(16);
  assert.equal(result, 30);
  result = exp(1, [
    [5, 1.5],
    [11, 4],
    [13, 6],
  ])(12);
  assert.equal(result, 5);
});

test("step", async () => {
  let f = step(0, []);
  assert.equal(0, f(0));
  f = step(5, [[4, 10]]);
  assert.equal(5, f(0));
  assert.equal(10, f(4));
  assert.equal(10, f(5));
  f = step(5, [
    [4, 10],
    [5, 15],
  ]);
  assert.equal(5, f(0));
  assert.equal(10, f(4));
  assert.equal(15, f(5));
  f = step(5, [
    [4, 10],
    [5, 12],
    [6, 15],
  ]);
  assert.equal(5, f(0));
  assert.equal(10, f(4));
  assert.equal(12, f(5));
  assert.equal(15, f(6));
  assert.equal(15, f(7));
});

test("linear", async () => {
  let f = linear([]);
  assert.equal(0, f(0));
  f = linear([[4, 10]]);
  assert.equal(10, f(4));
  assert.equal(10, f(5));
  f = linear([
    [4, 10],
    [6, 20],
  ]);
  assert.equal(10, f(3));
  assert.equal(10, f(4));
  assert.equal(15, f(5));
  assert.equal(20, f(6));
  assert.equal(20, f(7));
});

const precisionMatch = 0.0001;
const almostEqual = (a, b) => Math.abs(a - b) <= precisionMatch;

test("cubic-bezier", async () => {
  let f = cubicBezier(0.42, 0, 0.58, 1, []);
  assert.equal(0, f(0));
  f = cubicBezier(0.42, 0, 0.58, 1, [
    [0, 0],
    [100, 100],
  ]);
  assert(almostEqual(0, f(0)));
  assert(almostEqual(1.97224, f(10)));
  assert(almostEqual(8.16597, f(20)));
  assert(almostEqual(18.7395, f(30)));
  assert(almostEqual(33.1883, f(40)));
  assert(almostEqual(50, f(50)));
  assert(almostEqual(66.8116, f(60)));
  assert(almostEqual(81.2604, f(70)));
  assert(almostEqual(91.834, f(80)));
  assert(almostEqual(98.0277, f(90)));
  assert(almostEqual(100, f(100)));
});

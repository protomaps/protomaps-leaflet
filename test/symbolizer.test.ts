import { exp, step, linear } from "../src/symbolizer";
import assert from "assert";
import baretest from "baretest";

test = baretest("symbolizer");

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
  let f = step([]);
  assert.equal(0, f(0));
  f = step([[4, 10]]);
  assert.equal(0, f(0));
  assert.equal(10, f(4));
  assert.equal(10, f(5));
  f = step([
    [4, 10],
    [5, 12],
  ]);
  assert.equal(0, f(0));
  assert.equal(10, f(4));
  assert.equal(12, f(5));
  assert.equal(12, f(6));
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

export default test;

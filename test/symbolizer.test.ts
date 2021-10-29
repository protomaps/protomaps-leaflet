import {
  exp,
  step,
  linear,
  cubicBezier,
  LineSymbolizer,
} from "../src/symbolizer";
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

test("LineSymbolizer", async () => {
  let ctx = {
    setLineDashCalls: 0,
    strokeCalls: 0,
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    save: () => {},
    stroke: () => {
      ctx.strokeCalls++;
    },
    setLineDash: () => {
      ctx.setLineDashCalls++;
    },
    restore: () => {},
  };
  // Test default values
  let symbolizer = new LineSymbolizer({});
  assert(symbolizer.color, "black");
  assert(symbolizer.width, 1);
  assert(symbolizer.opacity, 1);
  assert(symbolizer.dash === null);
  assert(symbolizer.dashColor, "black");
  assert(symbolizer.dashWidth, 1.0);
  assert(symbolizer.dashWidth, 1.0);
  assert(symbolizer.lineCap, "butt");
  assert(symbolizer.lineJoin, "miter");
  assert(symbolizer.skip === false);
  assert(!symbolizer.per_feature);
  symbolizer.before(ctx, 0);
  assert(ctx.strokeStyle, symbolizer.color);
  assert(ctx.lineWidth, symbolizer.width);
  assert(ctx.globalAlpha, symbolizer.opacity);
  assert(ctx.lineCap, symbolizer.lineCap);
  assert(ctx.lineJoin, symbolizer.lineJoin);
  // Should not override globalAlpha, lineCap or lineJoin
  // when not evaluating per feature, should not
  // call setLineDash and should call stroke
  ctx.globalAlpha = 0.0;
  ctx.lineCap = "miter";
  ctx.lineJoin = "butt";
  symbolizer.draw(ctx, [[0, 0]], 0, {});
  assert(ctx.globalAlpha === 0.0);
  assert(ctx.lineCap, "miter");
  assert(ctx.lineJoin, "butt");
  assert(ctx.setLineDashCalls === 0);
  assert(ctx.strokeCalls !== 0);

  // Test LineSymbolizer with dash
  symbolizer = new LineSymbolizer({ dash: [2, 2] });
  assert(symbolizer.dash !== null);
  assert(symbolizer.per_feature);
  // Should not set global attributes
  ctx.strokeStyle = "";
  ctx.lineWidth = 0;
  ctx.globalAlpha = 0;
  ctx.lineCap = "butt";
  ctx.lineCap = "miter";
  symbolizer.before(ctx, 0);
  assert(ctx.strokeStyle == "");
  assert(ctx.lineWidth === 0);
  assert(ctx.globalAlpha === 0);
  assert(ctx.lineCap, "butt");
  assert(ctx.lineJoin, "miter");
  // Should override globalAlpha, lineCap, lineJoin,
  // lineWidth and strokeStyle when evaluating per feature,
  // should call setLineDash and should call stroke
  ctx.globalAlpha = 0.0;
  ctx.lineCap = "miter";
  ctx.lineJoin = "butt";
  ctx.lineWidth = 0;
  ctx.strokeStyle = "";
  ctx.strokeCalls = 0;
  symbolizer.draw(ctx, [[0, 0]], 0, {});
  assert(ctx.globalAlpha !== 0.0);
  assert(ctx.lineCap !== "miter");
  assert(ctx.lineJoin !== "butt");
  assert(ctx.lineWidth !== 0);
  assert(ctx.strokeStyle !== "");
  assert(ctx.setLineDashCalls === 1);
  assert(ctx.strokeCalls !== 0);

  // Test LineSymbolizer with no dash but per feature properties
  symbolizer = new LineSymbolizer({ color: (z, f) => "white" });
  assert(symbolizer.per_feature);
  // Should not set global attributes
  ctx.strokeStyle = "";
  ctx.lineWidth = 0;
  ctx.globalAlpha = 0;
  ctx.lineCap = "butt";
  ctx.lineCap = "miter";
  symbolizer.before(ctx, 0);
  assert(ctx.strokeStyle == "");
  assert(ctx.lineWidth === 0);
  assert(ctx.globalAlpha === 0);
  assert(ctx.lineCap, "butt");
  assert(ctx.lineJoin, "miter");
  // Should override globalAlpha, lineCap, lineJoin,
  // lineWidth and strokeStyle when evaluating per feature,
  // should not call setLineDash and should call stroke
  ctx.globalAlpha = 0.0;
  ctx.lineCap = "miter";
  ctx.lineJoin = "butt";
  ctx.lineWidth = 0;
  ctx.strokeStyle = "";
  ctx.setLineDashCalls = 0;
  ctx.strokeCalls = 0;
  symbolizer.draw(ctx, [[0, 0]], 0, {});
  assert(ctx.globalAlpha !== 0.0);
  assert(ctx.lineCap !== "miter");
  assert(ctx.lineJoin !== "butt");
  assert(ctx.lineWidth !== 0);
  assert(ctx.strokeStyle === "white");
  assert(ctx.setLineDashCalls === 0);
  assert(ctx.strokeCalls !== 0);

  // Test LineSymbolizer with no per feature properties
  symbolizer = new LineSymbolizer({ color: "white" });
  assert(!symbolizer.per_feature);
  // Should set global attributes
  ctx.strokeStyle = "";
  ctx.lineWidth = 0;
  ctx.globalAlpha = 0;
  ctx.lineCap = "miter";
  ctx.lineCap = "butt";
  symbolizer.before(ctx, 0);
  assert(ctx.strokeStyle === "white");
  assert(ctx.lineWidth !== 0);
  assert(ctx.globalAlpha !== 0);
  assert(ctx.lineCap === "butt");
  assert(ctx.lineJoin === "miter");
  // Should NOT override globalAlpha, lineCap, lineJoin,
  // lineWidth or strokeStyle,
  // should not call setLineDash and should call stroke
  ctx.globalAlpha = 0.0;
  ctx.lineCap = "miter";
  ctx.lineJoin = "butt";
  ctx.lineWidth = 0;
  ctx.strokeStyle = "";
  ctx.setLineDashCalls = 0;
  ctx.strokeCalls = 0;
  symbolizer.draw(ctx, [[0, 0]], 0, {});
  assert(ctx.globalAlpha === 0.0);
  assert(ctx.lineCap === "miter");
  assert(ctx.lineJoin === "butt");
  assert(ctx.lineWidth === 0);
  assert(ctx.strokeStyle === "");
  assert(ctx.setLineDashCalls === 0);
  assert(ctx.strokeCalls !== 0);
});

export default test;

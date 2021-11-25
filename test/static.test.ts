import assert from "assert";
import baretest from "baretest";
import { getZoom } from "../src/frontends/static";

const test = baretest("Static");

// test("basic", async () => {
//   assert.equal(getZoom(360, 256), 0);
//   assert.equal(getZoom(360, 512), 1);
//   assert.equal(getZoom(360, 1024), 2);
//   assert.equal(getZoom(180, 256), 1);
// });

export default test;

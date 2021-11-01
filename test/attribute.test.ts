import assert from "assert";
import baretest from "baretest";
import {
  ArrayAttr,
  FontAttr,
  NumberAttr,
  StringAttr,
  TextAttr,
} from "../src/attribute";
import { GeomType } from "../src/tilecache";
import { emptyFeature } from "./json_style.test";

const test = baretest("Attribute");

test("numberattr", async () => {
  let n = new NumberAttr(undefined, undefined);
  assert.equal(n.get(1), 1);

  n = new NumberAttr(2, undefined);
  assert.equal(n.get(1), 2);

  n = new NumberAttr(undefined, 3);
  assert.equal(n.get(1), 3);

  n = new NumberAttr(undefined, 0);
  assert.equal(n.get(1), 0);

  n = new NumberAttr((z, f) => {
    return z;
  }, 0);
  assert.equal(n.get(2), 2);
  assert.equal(n.get(3), 3);

  n = new NumberAttr(1);
  assert.equal(n.per_feature, false);
  n = new NumberAttr((z) => {
    return z;
  });
  assert.equal(n.per_feature, false);
  n = new NumberAttr((z, f) => {
    return z;
  });
  assert.equal(n.per_feature, true);
});

test("stringattr", async () => {
  const c1 = new StringAttr(undefined, "");
  assert.equal(c1.get(1), "");

  const c2 = new StringAttr(undefined, "red");
  assert.equal(c2.get(1), "red");

  const c3 = new StringAttr("blue", "green");
  assert.equal(c3.get(1), "blue");

  const c4 = new StringAttr((z, f) => {
    if (z < 4) return "green";
    return "aquamarine";
  }, undefined);
  assert.equal(c4.get(3), "green");
  assert.equal(c4.get(5), "aquamarine");
  assert.equal(c4.per_feature, true);
});

test("fontattr", async () => {
  let f = new FontAttr({ font: "12px serif" });
  assert.equal(f.get(1), "12px serif");

  f = new FontAttr({
    font: (z) => {
      return z == 1 ? "12px serif" : "14px serif";
    },
  });
  assert.equal(f.get(1), "12px serif");
  assert.equal(f.get(2), "14px serif");

  f = new FontAttr({
    fontFamily: "serif",
    fontWeight: 500,
    fontStyle: "italic",
    fontSize: 14,
  });
  assert.equal(f.get(1), "italic 500 14px serif");

  f = new FontAttr({});
  assert.equal(f.get(1), "12px sans-serif");

  f = new FontAttr({
    fontWeight: (z) => {
      return z == 1 ? 400 : 600;
    },
  });
  assert.equal(f.get(1), "400 12px sans-serif");
  assert.equal(f.get(2), "600 12px sans-serif");

  f = new FontAttr({
    fontSize: (z) => {
      return z == 1 ? 12 : 14;
    },
  });
  assert.equal(f.get(1), "12px sans-serif");
  assert.equal(f.get(2), "14px sans-serif");

  f = new FontAttr({
    fontStyle: (z) => {
      return z == 1 ? "normal" : "italic";
    },
  });
  assert.equal(f.get(1), "normal 12px sans-serif");
  assert.equal(f.get(2), "italic 12px sans-serif");

  f = new FontAttr({
    fontFamily: (z) => {
      return z == 1 ? "sans-serif" : "serif";
    },
  });
  assert.equal(f.get(1), "12px sans-serif");
  assert.equal(f.get(2), "12px serif");
});

test("textattr", async () => {
  let t = new TextAttr();
  assert.equal(t.get(0, { ...emptyFeature, props: { name: "臺北" } }), "臺北");
  t = new TextAttr({ label_props: ["name:en"] });
  assert.equal(
    t.get(0, {
      ...emptyFeature,
      props: { "name:en": "Taipei", name: "臺北" },
    }),
    "Taipei"
  );
  t = new TextAttr({ label_props: ["name:en"], textTransform: "uppercase" });
  assert.equal(
    t.get(0, { ...emptyFeature, props: { "name:en": "Taipei" } }),
    "TAIPEI"
  );
  t = new TextAttr({ label_props: ["name:en"], textTransform: "lowercase" });
  assert.equal(
    t.get(0, {
      ...emptyFeature,
      props: { "name:en": "Taipei" },
      geomType: GeomType.Point,
    }),
    "taipei"
  );
  t = new TextAttr({ label_props: ["name:en"], textTransform: "capitalize" });
  assert.equal(
    t.get(0, {
      ...emptyFeature,
      props: { "name:en": "from Berga to Taipei" },
      geomType: GeomType.Point,
    }),
    "From Berga To Taipei"
  );
  t = new TextAttr({ label_props: ["name:en"], textTransform: "uppercase" });
  assert.equal(t.get(0, { ...emptyFeature, props: {} }), undefined);

  t = new TextAttr({
    label_props: ["name:en"],
    textTransform: (z) => "uppercase",
  });
  assert.equal(
    t.get(0, {
      ...emptyFeature,
      props: { "name:en": "Taipei" },
      geomType: GeomType.Point,
    }),
    "TAIPEI"
  );
  t = new TextAttr({
    label_props: ["name:en"],
    textTransform: (z) => "lowercase",
  });
  assert.equal(
    t.get(0, {
      ...emptyFeature,
      props: { "name:en": "Taipei" },
      geomType: GeomType.Point,
    }),
    "taipei"
  );
  t = new TextAttr({
    label_props: ["name:en"],
    textTransform: (z) => "capitalize",
  });
  assert.equal(
    t.get(0, {
      ...emptyFeature,
      props: { "name:en": "from Berga to Taipei" },
      geomType: GeomType.Point,
    }),
    "From Berga To Taipei"
  );

  t = new TextAttr({
    label_props: (z, f) => {
      if (z < 8) return ["abbr", "name"];
      return ["name"];
    },
    textTransform: "uppercase",
  });
  assert.equal(
    t.get(0, { ...emptyFeature, props: { name: "台北", abbr: "TPE" } }),
    "TPE"
  );
  assert.equal(
    t.get(9, { ...emptyFeature, props: { name: "台北", abbr: "TPE" } }),
    "台北"
  );
});

test("arrayattr", async () => {
  let n = new ArrayAttr(undefined, undefined);
  assert.equal(n.get(1).length, 0);

  n = new ArrayAttr(2, undefined);
  assert.equal(n.get(1), 2);

  n = new ArrayAttr(undefined, [3]);
  assert.equal(n.get(1)[0], 3);

  n = new ArrayAttr(undefined, [0]);
  assert.equal(n.get(1)[0], 0);

  n = new ArrayAttr(
    (z, f) => {
      return [z, z];
    },
    [0]
  );
  assert.equal(n.get(2)[0], 2);
  assert.equal(n.get(2)[1], 2);
  assert.equal(n.get(3)[0], 3);
  assert.equal(n.get(3)[1], 3);

  n = new ArrayAttr(1);
  assert.equal(n.per_feature, false);
  n = new ArrayAttr((z) => {
    return z;
  });
  assert.equal(n.per_feature, false);
  n = new ArrayAttr((z, f) => {
    return z;
  });
  assert.equal(n.per_feature, true);
});

export default test;

import { Filter } from "../painter";
import { Feature, JsonValue } from "../tilecache";
import {
  CenteredTextSymbolizer,
  CircleSymbolizer,
  exp,
  LineLabelSymbolizer,
  LineSymbolizer,
  PolygonSymbolizer,
} from "./../symbolizer";

function number(val: JsonValue, defaultValue: number) {
  return typeof val === "number" ? val : defaultValue;
}

export function filterFn(arr: any[]): Filter {
  // hack around "$type"
  if (arr.includes("$type")) {
    return (z) => true;
  } else if (arr[0] == "==") {
    return (z, f) => f.props[arr[1]] === arr[2];
  } else if (arr[0] == "!=") {
    return (z, f) => f.props[arr[1]] !== arr[2];
  } else if (arr[0] == "!") {
    let sub = filterFn(arr[1]);
    return (z, f) => !sub(z, f);
  } else if (arr[0] === "<") {
    return (z, f) => number(f.props[arr[1]], Infinity) < arr[2];
  } else if (arr[0] === "<=") {
    return (z, f) => number(f.props[arr[1]], Infinity) <= arr[2];
  } else if (arr[0] === ">") {
    return (z, f) => number(f.props[arr[1]], -Infinity) > arr[2];
  } else if (arr[0] === ">=") {
    return (z, f) => number(f.props[arr[1]], -Infinity) >= arr[2];
  } else if (arr[0] === "in") {
    return (z, f) => arr.slice(2, arr.length).includes(f.props[arr[1]]);
  } else if (arr[0] === "!in") {
    return (z, f) => !arr.slice(2, arr.length).includes(f.props[arr[1]]);
  } else if (arr[0] === "has") {
    return (z, f) => f.props.hasOwnProperty(arr[1]);
  } else if (arr[0] === "!has") {
    return (z, f) => !f.props.hasOwnProperty(arr[1]);
  } else if (arr[0] === "all") {
    let parts = arr.slice(1, arr.length).map((e) => filterFn(e));
    return (z, f) =>
      parts.every((p) => {
        return p(z, f);
      });
  } else if (arr[0] === "any") {
    let parts = arr.slice(1, arr.length).map((e) => filterFn(e));
    return (z, f) =>
      parts.some((p) => {
        return p(z, f);
      });
  } else {
    console.log("Unimplemented filter: ", arr[0]);
    return (f) => false;
  }
}

export function numberFn(obj: any): (z: number, f?: Feature) => number {
  if (obj.base && obj.stops) {
    return (z: number) => {
      return exp(obj.base, obj.stops)(z - 1);
    };
  } else if (
    obj[0] == "interpolate" &&
    obj[1][0] == "exponential" &&
    obj[2] == "zoom"
  ) {
    let slice = obj.slice(3);
    let stops: number[][] = [];
    for (var i = 0; i < slice.length; i += 2) {
      stops.push([slice[i], slice[i + 1]]);
    }
    return (z: number) => {
      return exp(obj[1][1], stops)(z - 1);
    };
  } else if (obj[0] == "step" && obj[1][0] == "get") {
    let slice = obj.slice(2);
    let prop = obj[1][1];
    return (z: number, f?: Feature) => {
      let val = f?.props[prop];
      if (typeof val === "number") {
        if (val < slice[1]) return slice[0];
        for (i = 1; i < slice.length; i += 2) {
          if (val <= slice[i]) return slice[i + 1];
        }
      }
      return slice[slice.length - 1];
    };
  } else {
    console.log("Unimplemented numeric fn: ", obj);
    return (z) => 1;
  }
}

export function numberOrFn(
  obj: any,
  defaultValue = 0
): number | ((z: number, f?: Feature) => number) {
  if (!obj) return defaultValue;
  if (typeof obj == "number") {
    return obj;
  }
  // If feature f is defined, use numberFn, otherwise use defaultValue
  return (z: number, f?: Feature) => (f ? numberFn(obj)(z, f) : defaultValue);
}

export function widthFn(width_obj: any, gap_obj: any) {
  let w = numberOrFn(width_obj, 1);
  let g = numberOrFn(gap_obj);
  return (z: number, f?: Feature) => {
    let tmp = typeof w == "number" ? w : w(z, f);
    if (g) {
      return tmp + (typeof g == "number" ? g : g(z, f));
    }
    return tmp;
  };
}

interface FontSub {
  face: string;
  weight?: number;
  style?: string;
}

export function getFont(obj: any, fontsubmap: any) {
  let fontfaces: FontSub[] = [];
  for (let wanted_face of obj["text-font"]) {
    if (fontsubmap.hasOwnProperty(wanted_face)) {
      fontfaces.push(fontsubmap[wanted_face]);
    }
  }
  if (fontfaces.length === 0) fontfaces.push({ face: "sans-serif" });

  let text_size = obj["text-size"];
  // for fallbacks, use the weight and style of the first font
  var weight = "";
  if (fontfaces.length && fontfaces[0].weight)
    weight = fontfaces[0].weight + " ";
  var style = "";
  if (fontfaces.length && fontfaces[0].style) style = fontfaces[0].style + " ";

  if (typeof text_size == "number") {
    return (z: number) =>
      `${style}${weight}${text_size}px ${fontfaces
        .map((f) => f.face)
        .join(", ")}`;
  } else if (text_size.stops) {
    var base = 1.4;
    if (text_size.base) base = text_size.base;
    else text_size.base = base;
    let t = numberFn(text_size);
    return (z: number, f?: Feature) => {
      return `${style}${weight}${t(z, f)}px ${fontfaces
        .map((f) => f.face)
        .join(", ")}`;
    };
  } else if (text_size[0] == "step") {
    let t = numberFn(text_size);
    return (z: number, f?: Feature) => {
      return `${style}${weight}${t(z, f)}px ${fontfaces
        .map((f) => f.face)
        .join(", ")}`;
    };
  } else {
    console.log("Can't parse font: ", obj);
    return (z: number) => "12px sans-serif";
  }
}

export function json_style(obj: any, fontsubmap: Map<string, FontSub>) {
  let paint_rules = [];
  let label_rules = [];
  let refs = new Map<string, any>();

  for (var layer of obj.layers) {
    refs.set(layer.id, layer);

    if (layer.layout && layer.layout.visibility == "none") {
      continue;
    }

    if (layer.ref) {
      let referenced = refs.get(layer.ref);
      layer.type = referenced.type;
      layer.filter = referenced.filter;
      layer.source = referenced["source"];
      layer["source-layer"] = referenced["source-layer"];
    }

    let sourceLayer = layer["source-layer"];
    var symbolizer;

    var filter = undefined;
    if (layer.filter) {
      filter = filterFn(layer.filter);
    }

    // ignore background-color?
    if (layer.type == "fill") {
      paint_rules.push({
        dataLayer: layer["source-layer"],
        filter: filter,
        symbolizer: new PolygonSymbolizer({
          fill: layer.paint["fill-color"],
          opacity: layer.paint["fill-opacity"],
        }),
      });
    } else if (layer.type == "fill-extrusion") {
      // simulate fill-extrusion with plain fill
      paint_rules.push({
        dataLayer: layer["source-layer"],
        filter: filter,
        symbolizer: new PolygonSymbolizer({
          fill: layer.paint["fill-extrusion-color"],
          opacity: layer.paint["fill-extrusion-opacity"],
        }),
      });
    } else if (layer.type == "line") {
      // simulate gap-width
      if (layer.paint["line-dasharray"]) {
        paint_rules.push({
          dataLayer: layer["source-layer"],
          filter: filter,
          symbolizer: new LineSymbolizer({
            width: widthFn(
              layer.paint["line-width"],
              layer.paint["line-gap-width"]
            ),
            dash: layer.paint["line-dasharray"],
            dashColor: layer.paint["line-color"],
          }),
        });
      } else {
        paint_rules.push({
          dataLayer: layer["source-layer"],
          filter: filter,
          symbolizer: new LineSymbolizer({
            color: layer.paint["line-color"],
            width: widthFn(
              layer.paint["line-width"],
              layer.paint["line-gap-width"]
            ),
          }),
        });
      }
    } else if (layer.type == "symbol") {
      if (layer.layout["symbol-placement"] == "line") {
        label_rules.push({
          dataLayer: layer["source-layer"],
          filter: filter,
          symbolizer: new LineLabelSymbolizer({
            font: getFont(layer.layout, fontsubmap),
            fill: layer.paint["text-color"],
            width: layer.paint["text-halo-width"],
            stroke: layer.paint["text-halo-color"],
            textTransform: layer.layout["text-transform"],
            label_props: layer.layout["text-field"]
              ? [layer.layout["text-field"]]
              : undefined,
          }),
        });
      } else {
        label_rules.push({
          dataLayer: layer["source-layer"],
          filter: filter,
          symbolizer: new CenteredTextSymbolizer({
            font: getFont(layer.layout, fontsubmap),
            fill: layer.paint["text-color"],
            stroke: layer.paint["text-halo-color"],
            width: layer.paint["text-halo-width"],
            textTransform: layer.layout["text-transform"],
            label_props: layer.layout["text-field"]
              ? [layer.layout["text-field"]]
              : undefined,
          }),
        });
      }
    } else if (layer.type == "circle") {
      paint_rules.push({
        dataLayer: layer["source-layer"],
        filter: filter,
        symbolizer: new CircleSymbolizer({
          radius: layer.paint["circle-radius"],
          fill: layer.paint["circle-color"],
          stroke: layer.paint["circle-stroke-color"],
          width: layer.paint["circle-stroke-width"],
        }),
      });
    }
  }

  label_rules.reverse();
  return { paint_rules: paint_rules, label_rules: label_rules, tasks: [] };
}

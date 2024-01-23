import { Rule } from "./painter";
import {
  CircleSymbolizer,
  LineSymbolizer,
  PolygonSymbolizer,
} from "./symbolizer";
import { GeomType } from "./tilecache";
import { PreparedTile } from "./view";

export interface XraySelection {
  dataSource?: string;
  dataLayer: string;
}

const xray_symbolizers = (
  dataSource: string,
  dataLayer: string,
  color: string,
): Rule[] => {
  return [
    {
      dataSource: dataSource,
      dataLayer: dataLayer,
      symbolizer: new CircleSymbolizer({
        opacity: 0.2,
        fill: color,
        radius: 4,
      }),
      filter: (z, f) => {
        return f.geomType === GeomType.Point;
      },
    },
    {
      dataSource: dataSource,
      dataLayer: dataLayer,
      symbolizer: new LineSymbolizer({
        opacity: 0.2,
        color: color,
        width: 2,
      }),
      filter: (z, f) => {
        return f.geomType === GeomType.Line;
      },
    },
    {
      dataSource: dataSource,
      dataLayer: dataLayer,
      symbolizer: new PolygonSymbolizer({
        opacity: 0.2,
        fill: color,
        stroke: color,
        width: 1,
      }),
      filter: (z, f) => {
        return f.geomType === GeomType.Polygon;
      },
    },
  ];
};

export const xray_rules = (
  prepared_tilemap: Map<string, PreparedTile[]>,
  xray: XraySelection, // the highlighted layer
): Rule[] => {
  let rules: Rule[] = [];
  for (const [dataSource, tiles] of prepared_tilemap) {
    for (const tile of tiles) {
      for (const dataLayer of tile.data.keys()) {
        if (dataSource === xray.dataSource && dataLayer === xray.dataLayer) {
          // do nothing since the highlighted layer should go last
        } else {
          rules = rules.concat(
            xray_symbolizers(dataSource, dataLayer, "steelblue"),
          );
        }
      }
    }
  }

  // the highlighted layer
  rules = rules.concat(
    xray_symbolizers(xray.dataSource || "", xray.dataLayer, "red"),
  );
  return rules;
};

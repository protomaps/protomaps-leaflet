import { type Flavor } from "@protomaps/basemaps";
import { mix } from "color2k";
import { LabelRule } from "../labeler";
import { PaintRule } from "../painter";
import {
  CenteredTextSymbolizer,
  CircleSymbolizer,
  GroupSymbolizer,
  LineLabelSymbolizer,
  LineSymbolizer,
  OffsetTextSymbolizer,
  PolygonSymbolizer,
  exp,
  linear,
} from "../symbolizer";
import { Feature, GeomType, JsonObject } from "../tilecache";

const getString = (props: JsonObject, key: string): string => {
  const val = props[key];
  if (typeof val === "string") return val;
  return "";
};

const getNumber = (props: JsonObject, key: string): number => {
  const val = props[key];
  if (typeof val === "number") return val;
  return 0;
};

export const paintRules = (t: Flavor): PaintRule[] => {
  return [
    {
      dataLayer: "earth",
      symbolizer: new PolygonSymbolizer({
        fill: t.earth,
      }),
    },
    ...(t.landcover
      ? [
          {
            dataLayer: "landcover",
            symbolizer: new PolygonSymbolizer({
              fill: (z, f) => {
                const landcover = t.landcover;
                if (!landcover || !f) return "";
                const kind = getString(f.props, "kind");
                if (kind === "grassland") return landcover.grassland;
                if (kind === "barren") return landcover.barren;
                if (kind === "urban_area") return landcover.urban_area;
                if (kind === "farmland") return landcover.farmland;
                if (kind === "glacier") return landcover.glacier;
                if (kind === "scrub") return landcover.scrub;
                return landcover.forest;
              },
              opacity: (z, f) => {
                if (z === 8) return 0.5;
                return 1;
              },
            }),
          },
        ]
      : []),
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: (z, f) => {
          return mix(t.park_a, t.park_b, Math.min(Math.max(z / 12.0, 12), 0));
        },
      }),
      filter: (z, f) => {
        const kind = getString(f.props, "kind");
        return ["allotments", "village_green", "playground"].includes(kind);
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.park_b,
        opacity: (z, f) => {
          if (z < 8) return 0;
          if (z === 8) return 0.5;
          return 1;
        },
      }),
      filter: (z, f) => {
        const kind = getString(f.props, "kind");
        return [
          "national_park",
          "park",
          "cemetery",
          "protected_area",
          "nature_reserve",
          "forest",
          "golf_course",
        ].includes(kind);
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.hospital,
      }),
      filter: (z, f) => {
        return f.props.kind === "hospital";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.industrial,
      }),
      filter: (z, f) => {
        return f.props.kind === "industrial";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.school,
      }),
      filter: (z, f) => {
        const kind = getString(f.props, "kind");
        return ["school", "university", "college"].includes(kind);
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.beach,
      }),
      filter: (z, f) => {
        return f.props.kind === "beach";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.zoo,
      }),
      filter: (z, f) => {
        return f.props.kind === "zoo";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.zoo,
      }),
      filter: (z, f) => {
        const kind = getString(f.props, "kind");
        return ["military", "naval_base", "airfield"].includes(kind);
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: (z, f) => {
          return mix(t.wood_a, t.wood_b, Math.min(Math.max(z / 12.0, 12), 0));
        },
        opacity: (z, f) => {
          if (z < 8) return 0;
          if (z === 8) return 0.5;
          return 1;
        },
      }),
      filter: (z, f) => {
        const kind = getString(f.props, "kind");
        return ["wood", "nature_reserve", "forest"].includes(kind);
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: (z, f) => {
          return mix(t.scrub_a, t.scrub_b, Math.min(Math.max(z / 12.0, 12), 0));
        },
      }),
      filter: (z, f) => {
        const kind = getString(f.props, "kind");
        return ["scrub", "grassland", "grass"].includes(kind);
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.scrub_b,
      }),
      filter: (z, f) => {
        const kind = getString(f.props, "kind");
        return ["scrub", "grassland", "grass"].includes(kind);
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.glacier,
      }),
      filter: (z, f) => {
        return f.props.kind === "glacier";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.sand,
        opacity: (z, f) => {
          if (z < 8) return 0;
          if (z === 8) return 0.5;
          return 1;
        },
      }),
      filter: (z, f) => {
        return f.props.kind === "sand";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.aerodrome,
      }),
      filter: (z, f) => {
        return f.props.kind === "aerodrome";
      },
    },
    {
      dataLayer: "water",
      symbolizer: new PolygonSymbolizer({
        fill: t.water,
      }),
      filter: (z, f) => {
        return f.geomType === GeomType.Polygon;
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: t.runway,
        width: (z, f) => {
          return exp(1.6, [
            [11, 0],
            [13, 4],
            [19, 30],
          ])(z);
        },
      }),
      filter: (z, f) => {
        return f.props.kind_detail === "runway";
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: t.runway,
        width: (z, f) => {
          return exp(1.6, [
            [14, 0],
            [14.5, 1],
            [16, 6],
          ])(z);
        },
      }),
      filter: (z, f) => {
        return f.props.kind_detail === "taxiway";
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: t.pier,
        width: (z, f) => {
          return exp(1.6, [
            [13, 0],
            [13.5, 0, 5],
            [21, 16],
          ])(z);
        },
      }),
      filter: (z, f) => {
        return f.props.kind === "path" && f.props.kind_detail === "pier";
      },
    },
    {
      dataLayer: "water",
      minzoom: 14,
      symbolizer: new LineSymbolizer({
        color: t.water,
        width: (z, f) => {
          return exp(1.6, [
            [9, 0],
            [9.5, 1.0],
            [18, 12],
          ])(z);
        },
      }),
      filter: (z, f) => {
        return f.geomType === GeomType.Line && f.props.kind === "river";
      },
    },
    {
      dataLayer: "water",
      minzoom: 14,
      symbolizer: new LineSymbolizer({
        color: t.water,
        width: 0.5,
      }),
      filter: (z, f) => {
        return f.geomType === GeomType.Line && f.props.kind === "stream";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.pedestrian,
      }),
      filter: (z, f) => {
        return f.props.kind === "pedestrian";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.pier,
      }),
      filter: (z, f) => {
        return f.props.kind === "pier";
      },
    },
    {
      dataLayer: "buildings",
      symbolizer: new PolygonSymbolizer({
        fill: t.buildings,
        opacity: 0.5,
      }),
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: t.major,
        width: (z, f) => {
          return exp(1.6, [
            [14, 0],
            [20, 7],
          ])(z);
        },
      }),
      filter: (z, f) => {
        const kind = getString(f.props, "kind");
        return ["other", "path"].includes(kind);
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: t.major,
        width: (z, f) => {
          return exp(1.6, [
            [13, 0],
            [18, 8],
          ])(z);
        },
      }),
      filter: (z, f) => {
        return f.props.kind === "minor_road";
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: t.major,
        width: (z, f) => {
          return exp(1.6, [
            [6, 0],
            [12, 1.6],
            [15, 3],
            [18, 13],
          ])(z);
        },
      }),
      filter: (z, f) => {
        return f.props.kind === "major_road";
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: t.major,
        width: (z, f) => {
          return exp(1.6, [
            [3, 0],
            [6, 1.1],
            [12, 1.6],
            [15, 5],
            [18, 15],
          ])(z);
        },
      }),
      filter: (z, f) => {
        return f.props.kind === "highway";
      },
    },
    {
      dataLayer: "boundaries",
      symbolizer: new LineSymbolizer({
        color: t.boundaries,
        width: 1,
      }),
      filter: (z, f) => {
        const minAdminLevel = f.props.kind_detail;
        return typeof minAdminLevel === "number" && minAdminLevel <= 2;
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        dash: [0.3, 0.75],
        color: t.railway,
        dashWidth: (z, f) => {
          return exp(1.6, [
            [4, 0],
            [7, 0.15],
            [19, 9],
          ])(z);
        },
        opacity: 0.5,
      }),
      filter: (z, f) => {
        return f.props.kind === "rail";
      },
    },
    {
      dataLayer: "boundaries",
      symbolizer: new LineSymbolizer({
        color: t.boundaries,
        width: 0.5,
      }),
      filter: (z, f) => {
        const minAdminLevel = f.props.kind_detail;
        return typeof minAdminLevel === "number" && minAdminLevel > 2;
      },
    },
  ];
};

export const labelRules = (t: Flavor, lang: string): LabelRule[] => {
  const nametags = [`name:${lang}`, "name"];

  return [
    // {
    //   id: "neighbourhood",
    //   dataLayer: "places",
    //   symbolizer: languageStack(
    //     new CenteredTextSymbolizer({
    //       labelProps: nametags,
    //       fill: params.neighbourhoodLabel,
    //       font: "500 10px sans-serif",
    //       textTransform: "uppercase",
    //     }),
    //     params.neighbourhoodLabel,
    //   ),
    //   filter: (z, f) => {
    //     return f.props["kind"] === "neighbourhood";
    //   },
    // },
    {
      dataLayer: "roads",
      symbolizer: new LineLabelSymbolizer({
        labelProps: nametags,
        fill: t.roads_label_minor,
        font: "400 12px sans-serif",
        width: 2,
        stroke: t.roads_label_minor_halo,
      }),
      // TODO: sort by minzoom
      minzoom: 16,
      filter: (z, f) => {
        const kind = getString(f.props, "kind");
        return ["minor_road", "other", "path"].includes(kind);
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineLabelSymbolizer({
        labelProps: nametags,
        fill: t.roads_label_major,
        font: "400 12px sans-serif",
        width: 2,
        stroke: t.roads_label_major_halo,
      }),
      // TODO: sort by minzoom
      minzoom: 12,
      filter: (z, f) => {
        const kind = getString(f.props, "kind");
        return ["highway", "major_road"].includes(kind);
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineLabelSymbolizer({
        labelProps: nametags,
        fill: t.roads_label_major,
        font: "400 12px sans-serif",
        width: 2,
        stroke: t.roads_label_major_halo,
      }),
      // TODO: sort by minzoom
      minzoom: 12,
      filter: (z, f) => {
        const kind = getString(f.props, "kind");
        return ["highway", "major_road"].includes(kind);
      },
    },
    {
      dataLayer: "water",
      symbolizer: new CenteredTextSymbolizer({
        labelProps: nametags,
        fill: t.ocean_label,
        lineHeight: 1.5,
        letterSpacing: 1,
        font: (z, f) => {
          const size = linear([
            [3, 10],
            [10, 12],
          ])(z);
          return `400 ${size}px sans-serif`;
        },
        textTransform: "uppercase",
      }),
      filter: (z, f) => {
        const kind = getString(f.props, "kind");
        return (
          f.geomType === GeomType.Point &&
          ["ocean", "bay", "strait", "fjord"].includes(kind)
        );
      },
    },
    {
      dataLayer: "water",
      symbolizer: new CenteredTextSymbolizer({
        labelProps: nametags,
        fill: t.ocean_label,
        lineHeight: 1.5,
        letterSpacing: 1,
        font: (z, f) => {
          const size = linear([
            [3, 10],
            [6, 12],
            [10, 12],
          ])(z);
          return `400 ${size}px sans-serif`;
        },
      }),
      filter: (z, f) => {
        const kind = getString(f.props, "kind");
        return (
          f.geomType === GeomType.Point &&
          ["sea", "lake", "water"].includes(kind)
        );
      },
    },
    {
      dataLayer: "places",
      symbolizer: new CenteredTextSymbolizer({
        labelProps: (z, f) => {
          if (z < 6) {
            return [`ref:${lang}`, "ref"];
          }
          return nametags;
        },
        fill: t.state_label,
        stroke: t.state_label_halo,
        width: 1,
        lineHeight: 1.5,
        font: (z: number, f?: Feature) => {
          return "400 12px sans-serif";
        },
        textTransform: "uppercase",
      }),
      filter: (z, f) => {
        return f.props.kind === "region";
      },
    },
    {
      dataLayer: "places",
      symbolizer: new CenteredTextSymbolizer({
        labelProps: nametags,
        fill: t.country_label,
        lineHeight: 1.5,
        font: (z: number, f?: Feature) => {
          if (z < 6) return "600 12px sans-serif";
          return "600 12px sans-serif";
        },
        textTransform: "uppercase",
      }),
      filter: (z, f) => {
        return f.props.kind === "country";
      },
    },
    {
      // places_locality
      dataLayer: "places",
      minzoom: 9,
      symbolizer: new CenteredTextSymbolizer({
        labelProps: nametags,
        fill: t.city_label,
        lineHeight: 1.5,
        font: (z: number, f?: Feature) => {
          if (!f) return "400 12px sans-serif";
          const minZoom = f.props.min_zoom;
          let weight = 400;
          if (minZoom && minZoom <= 5) {
            weight = 600;
          }
          let size = 12;
          const popRank = f.props.population_rank;
          if (popRank && popRank > 9) {
            size = 16;
          }
          return `${weight} ${size}px sans-serif`;
        },
      }),
      sort: (a, b) => {
        const aRank = getNumber(a, "min_zoom");
        const bRank = getNumber(b, "min_zoom");
        return aRank - bRank;
      },
      filter: (z, f) => {
        return f.props.kind === "locality";
      },
    },
    {
      dataLayer: "places",
      maxzoom: 8,
      symbolizer: new GroupSymbolizer([
        new CircleSymbolizer({
          radius: 2,
          fill: t.city_label,
          stroke: t.city_label_halo,
          width: 1.5,
        }),
        new OffsetTextSymbolizer({
          labelProps: nametags,
          fill: t.city_label,
          stroke: t.city_label_halo,
          width: 1,
          offsetX: 6,
          offsetY: 4.5,
          font: (z, f) => {
            return "400 12px sans-serif";
          },
        }),
      ]),
      filter: (z, f) => {
        return f.props.kind === "locality";
      },
    },
  ];
};

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
import { Feature, JsonObject } from "../tilecache";
import { Theme } from "./themes";

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

export const paintRules = (t: Theme): PaintRule[] => {
  return [
    {
      dataLayer: "earth",
      symbolizer: new PolygonSymbolizer({
        fill: t.earth,
      }),
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: (z, f) => {
          return mix(t.park_a, t.park_b, Math.min(Math.max(z / 12.0, 12), 0));
        },
      }),
      filter: (z, f) => {
        const kind = getString(f.props, "pmap:kind");
        return ["allotments", "village_green", "playground"].includes(kind);
      },
    },
    {
      // landuse_urban_green
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.park_b,
        opacity: 0.7,
      }),
      filter: (z, f) => {
        const kind = getString(f.props, "pmap:kind");
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
        return f.props["pmap:kind"] === "hospital";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.industrial,
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "industrial";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.school,
      }),
      filter: (z, f) => {
        const kind = getString(f.props, "pmap:kind");
        return ["school", "university", "college"].includes(kind);
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.beach,
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "beach";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.zoo,
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "zoo";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.zoo,
      }),
      filter: (z, f) => {
        const kind = getString(f.props, "pmap:kind");
        return ["military", "naval_base", "airfield"].includes(kind);
      },
    },
    {
      dataLayer: "natural",
      symbolizer: new PolygonSymbolizer({
        fill: (z, f) => {
          return mix(t.wood_a, t.wood_b, Math.min(Math.max(z / 12.0, 12), 0));
        },
      }),
      filter: (z, f) => {
        const kind = getString(f.props, "pmap:kind");
        return ["wood", "nature_reserve", "forest"].includes(kind);
      },
    },
    {
      dataLayer: "natural",
      symbolizer: new PolygonSymbolizer({
        fill: (z, f) => {
          return mix(t.scrub_a, t.scrub_b, Math.min(Math.max(z / 12.0, 12), 0));
        },
      }),
      filter: (z, f) => {
        const kind = getString(f.props, "pmap:kind");
        return ["scrub", "grassland", "grass"].includes(kind);
      },
    },
    {
      dataLayer: "natural",
      symbolizer: new PolygonSymbolizer({
        fill: t.scrub_b,
      }),
      filter: (z, f) => {
        const kind = getString(f.props, "pmap:kind");
        return ["scrub", "grassland", "grass"].includes(kind);
      },
    },
    {
      dataLayer: "natural",
      symbolizer: new PolygonSymbolizer({
        fill: t.glacier,
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "glacier";
      },
    },
    {
      dataLayer: "natural",
      symbolizer: new PolygonSymbolizer({
        fill: t.sand,
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "sand";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.aerodrome,
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "aerodrome";
      },
    },
    {
      dataLayer: "water",
      symbolizer: new PolygonSymbolizer({
        fill: t.water,
      }),
    },
    {
      // transit_runway
      dataLayer: "transit",
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
        return f.props["pmap:kind_detail"] === "runway";
      },
    },
    {
      // transit_taxiway
      dataLayer: "transit",
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
        return f.props["pmap:kind_detail"] === "taxiway";
      },
    },
    {
      // transit_pier
      dataLayer: "transit",
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
        return f.props["pmap:kind"] === "pier";
      },
    },
    {
      // physical_line_river
      dataLayer: "physical_line",
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
        return f.props["pmap:kind"] === "river";
      },
    },
    {
      // physical_line_river
      dataLayer: "physical_line",
      minzoom: 14,
      symbolizer: new LineSymbolizer({
        color: t.water,
        width: 0.5,
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "stream";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.pedestrian,
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "pedestrian";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: t.pier,
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "pier";
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
        const kind = getString(f.props, "pmap:kind");
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
        return f.props["pmap:kind"] === "minor_road";
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: t.major,
        width: (z, f) => {
          return exp(1.6, [
            [7, 0],
            [12, 1.2],
            [15, 3],
            [18, 13],
          ])(z);
        },
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "medium_road";
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
        return f.props["pmap:kind"] === "major_road";
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
        return f.props["pmap:kind"] === "highway";
      },
    },
    {
      dataLayer: "boundaries",
      symbolizer: new LineSymbolizer({
        dash: [3, 2],
        color: t.boundaries,
        width: 1,
      }),
      filter: (z, f) => {
        const minAdminLevel = f.props["pmap:min_admin_level"];
        return typeof minAdminLevel === "number" && minAdminLevel <= 2;
      },
    },
    {
      dataLayer: "transit",
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
        return f.props["pmap:kind"] === "rail";
      },
    },
    {
      dataLayer: "boundaries",
      symbolizer: new LineSymbolizer({
        dash: [3, 2],
        color: t.boundaries,
        width: 0.5,
      }),
      filter: (z, f) => {
        const minAdminLevel = f.props["pmap:min_admin_level"];
        return typeof minAdminLevel === "number" && minAdminLevel > 2;
      },
    },
  ];
};

export const labelRules = (t: Theme): LabelRule[] => {
  const nametags = ["name"];

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
    //     return f.props["pmap:kind"] === "neighbourhood";
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
        const kind = getString(f.props, "pmap:kind");
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
        const kind = getString(f.props, "pmap:kind");
        return ["highway", "major_road", "medium_road"].includes(kind);
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
        const kind = getString(f.props, "pmap:kind");
        return ["highway", "major_road", "medium_road"].includes(kind);
      },
    },
    {
      dataLayer: "physical_point",
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
        const kind = getString(f.props, "pmap:kind");
        return ["ocean", "bay", "strait", "fjord"].includes(kind);
      },
    },
    {
      dataLayer: "physical_point",
      symbolizer: new CenteredTextSymbolizer({
        labelProps: nametags,
        fill: t.ocean_label,
        lineHeight: 1.5,
        letterSpacing: 1,
        font: (z, f) => {
          const size = linear([
            [3, 0],
            [6, 12],
            [10, 12],
          ])(z);
          return `400 ${size}px sans-serif`;
        },
      }),
      filter: (z, f) => {
        const kind = getString(f.props, "pmap:kind");
        return ["sea", "lake", "water"].includes(kind);
      },
    },
    {
      dataLayer: "places",
      symbolizer: new CenteredTextSymbolizer({
        labelProps: (z, f) => {
          if (z < 6) {
            return ["name:short"];
          }
          return nametags;
        },
        fill: t.state_label,
        stroke: t.state_label_halo,
        width: 1,
        lineHeight: 1.5,
        font: (z: number, f?: Feature) => {
          if (z < 6) return "400 16px sans-serif";
          return "400 12px sans-serif";
        },
        textTransform: "uppercase",
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "region";
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
        return f.props["pmap:kind"] === "country";
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
          const minZoom = f.props["pmap:min_zoom"];
          let weight = 400;
          if (minZoom && minZoom <= 5) {
            weight = 600;
          }
          let size = 12;
          const popRank = f.props["pmap:population_rank"];
          if (popRank && popRank > 9) {
            size = 16;
          }
          return `${weight} ${size}px sans-serif`;
        },
      }),
      sort: (a, b) => {
        const aRank = getNumber(a, "pmap:population_rank");
        const bRank = getNumber(b, "pmap:population_rank");
        return aRank - bRank;
      },
      filter: (z, f) => {
        return f.props["pmap:kind"] === "locality";
      },
    },
    {
      dataLayer: "places",
      maxzoom: 8,
      symbolizer: new GroupSymbolizer([
        new CircleSymbolizer({
          radius: 2,
          fill: t.city_circle,
          stroke: t.city_circle_stroke,
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
        return f.props["pmap:kind"] === "locality";
      },
    },
  ];
};

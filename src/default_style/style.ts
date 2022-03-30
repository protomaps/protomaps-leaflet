import { hsla, parseToHsla } from "color2k";
import { LabelRule } from "../labeler";
import { Rule } from "../painter";
import {
  CenteredTextSymbolizer,
  CircleSymbolizer,
  exp,
  FlexSymbolizer,
  GroupSymbolizer,
  LabelSymbolizer,
  LineLabelSymbolizer,
  LineSymbolizer,
  OffsetTextSymbolizer,
  PolygonLabelSymbolizer,
  PolygonSymbolizer,
  ShieldSymbolizer,
} from "../symbolizer";
import { Feature } from "../tilecache";

export interface DefaultStyleParams {
  earth: string;
  glacier: string;
  residential: string;
  hospital: string;
  cemetery: string;
  school: string;
  industrial: string;
  wood: string;
  grass: string;
  park: string;
  water: string;
  sand: string;
  buildings: string;
  highwayCasing: string;
  majorRoadCasing: string;
  mediumRoadCasing: string;
  minorRoadCasing: string;
  highway: string;
  majorRoad: string;
  mediumRoad: string;
  minorRoad: string;
  boundaries: string;
  mask: string;
  countryLabel: string;
  cityLabel: string;
  stateLabel: string;
  neighbourhoodLabel: string;
  landuseLabel: string;
  waterLabel: string;
  naturalLabel: string;
  roadsLabel: string;
  poisLabel: string;
}

const doShading = (params: DefaultStyleParams, shade: string) => {
  let shadeHsl = parseToHsla(shade);
  let outParams: any = { ...params };
  for (const [key, value] of Object.entries(params)) {
    let o = parseToHsla(value);
    outParams[key] = hsla(shadeHsl[0], shadeHsl[1], o[2], o[3]);
  }
  return outParams;
};

export const paintRules = (
  params: DefaultStyleParams,
  shade: string
): Rule[] => {
  if (shade) params = doShading(params, shade);
  return [
    {
      dataLayer: "earth",
      symbolizer: new PolygonSymbolizer({
        fill: params.earth,
      }),
    },
    {
      dataLayer: "natural",
      symbolizer: new PolygonSymbolizer({
        fill: params.glacier,
      }),
      filter: (z, f) => {
        return f.props.natural == "glacier";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: params.residential,
      }),
      filter: (z, f) => {
        return (
          f.props.landuse == "residential" || f.props.place == "neighbourhood"
        );
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: params.hospital,
      }),
      filter: (z, f) => {
        return f.props.amenity == "hospital";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: params.cemetery,
      }),
      filter: (z, f) => {
        return f.props.landuse == "cemetery";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: params.school,
      }),
      filter: (z, f) => {
        return (
          f.props.amenity == "school" ||
          f.props.amenity == "kindergarten" ||
          f.props.amenity == "university" ||
          f.props.amenity == "college"
        );
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: params.industrial,
      }),
      filter: (z, f) => {
        return f.props.landuse == "industrial";
      },
    },
    {
      dataLayer: "natural",
      symbolizer: new PolygonSymbolizer({
        fill: params.wood,
      }),
      filter: (z, f) => {
        return f.props.natural == "wood";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: params.grass,
      }),
      filter: (z, f) => {
        return f.props.landuse == "grass";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        fill: params.park,
      }),
      filter: (z, f) => {
        return f.props.leisure == "park";
      },
    },
    {
      dataLayer: "water",
      symbolizer: new PolygonSymbolizer({
        fill: params.water,
      }),
    },
    {
      dataLayer: "natural",
      symbolizer: new PolygonSymbolizer({
        fill: params.sand,
      }),
      filter: (z, f) => {
        return f.props.natural == "sand";
      },
    },
    {
      dataLayer: "buildings",
      symbolizer: new PolygonSymbolizer({
        fill: params.buildings,
      }),
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: params.highwayCasing,
        width: exp(1.4, [
          [5, 1.5],
          [11, 4],
          [16, 9],
          [20, 40],
        ]),
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] == "highway";
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: params.majorRoadCasing,
        width: exp(1.4, [
          [9, 3],
          [12, 4],
          [17, 8],
          [20, 22],
        ]),
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] == "major_road";
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: params.mediumRoadCasing,
        width: exp(1.4, [
          [13, 3],
          [17, 6],
          [20, 18],
        ]),
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] == "medium_road";
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: params.minorRoadCasing,
        width: exp(1.4, [
          [14, 2],
          [17, 5],
          [20, 15],
        ]),
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] == "minor_road";
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: params.minorRoad,
        width: exp(1.4, [
          [14, 1],
          [17, 3],
          [20, 13],
        ]),
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] == "minor_road";
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: params.mediumRoad,
        width: exp(1.4, [
          [13, 2],
          [17, 4],
          [20, 15],
        ]),
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] == "medium_road";
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: params.majorRoad,
        width: exp(1.4, [
          [9, 2],
          [12, 3],
          [17, 6],
          [20, 20],
        ]),
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] == "major_road";
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: params.highway,
        width: exp(1.4, [
          [5, 0.5],
          [11, 2.5],
          [16, 7],
          [20, 30],
        ]),
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] == "highway";
      },
    },
    {
      dataLayer: "boundaries",
      symbolizer: new LineSymbolizer({
        color: params.boundaries,
        width: 2,
        opacity: 0.4,
      }),
    },
    {
      dataLayer: "mask",
      symbolizer: new PolygonSymbolizer({
        fill: params.mask,
      }),
    },
  ];
};

export const labelRules = (
  params: DefaultStyleParams,
  shade: string,
  language1: string[],
  language2: string[]
): LabelRule[] => {
  if (shade) params = doShading(params, shade);
  var nametags = ["name"];
  if (language1) nametags = language1;

  let languageStack = (symbolizer: LabelSymbolizer, fill: string) => {
    if (!language2) return symbolizer;
    if (symbolizer instanceof OffsetTextSymbolizer) {
      return new FlexSymbolizer([
        symbolizer,
        new OffsetTextSymbolizer({
          fill: fill,
          label_props: language2,
        }),
      ]);
    } else {
      return new FlexSymbolizer([
        symbolizer,
        new CenteredTextSymbolizer({
          fill: fill,
          label_props: language2,
        }),
      ]);
    }
  };

  return [
    {
      dataLayer: "places",
      symbolizer: languageStack(
        new CenteredTextSymbolizer({
          label_props: nametags,
          fill: params.countryLabel,
          lineHeight: 1.5,
          font: (z: number, f?: Feature) => {
            if (z < 6) return "200 14px sans-serif";
            return "200 20px sans-serif";
          },
          textTransform: "uppercase",
        }),
        params.countryLabel
      ),
      filter: (z, f) => {
        return f.props["pmap:kind"] == "country";
      },
    },
    {
      dataLayer: "places",
      symbolizer: languageStack(
        new CenteredTextSymbolizer({
          label_props: nametags,
          fill: params.stateLabel,
          font: "300 16px sans-serif",
        }),
        params.stateLabel
      ),
      filter: (z, f) => {
        return f.props["pmap:kind"] == "state";
      },
    },
    {
      id: "cities_high",
      dataLayer: "places",
      filter: (z, f) => {
        return f.props["pmap:kind"] == "city";
      },
      minzoom: 7,
      symbolizer: languageStack(
        new CenteredTextSymbolizer({
          label_props: nametags,
          fill: params.cityLabel,
          font: (z: number, f?: Feature) => {
            if (f?.props["pmap:rank"] === 1) {
              if (z > 8) return "600 20px sans-serif";
              return "600 12px sans-serif";
            } else {
              if (z > 8) return "600 16px sans-serif";
              return "600 10px sans-serif";
            }
          },
        }),
        params.cityLabel
      ),
      sort: (a: any, b: any) => {
        return a["pmap:rank"] - b["pmap:rank"];
      },
    },
    {
      id: "cities_low",
      dataLayer: "places",
      filter: (z, f) => {
        return f.props["pmap:kind"] == "city";
      },
      maxzoom: 6,
      symbolizer: new GroupSymbolizer([
        new CircleSymbolizer({
          radius: 2,
          fill: params.cityLabel,
        }),
        languageStack(
          new OffsetTextSymbolizer({
            label_props: nametags,
            fill: params.cityLabel,
            offsetX: 2,
            offsetY: 2,
            font: (z: number, f?: Feature) => {
              if (f?.props["pmap:rank"] === 1) {
                if (z > 8) return "600 20px sans-serif";
                return "600 12px sans-serif";
              } else {
                if (z > 8) return "600 16px sans-serif";
                return "600 10px sans-serif";
              }
            },
          }),
          params.cityLabel
        ),
      ]),
      sort: (a: any, b: any) => {
        return a["pmap:rank"] - b["pmap:rank"];
      },
    },
    {
      id: "neighbourhood",
      dataLayer: "places",
      symbolizer: languageStack(
        new CenteredTextSymbolizer({
          label_props: nametags,
          fill: params.neighbourhoodLabel,
          font: "500 10px sans-serif",
          textTransform: "uppercase",
        }),
        params.neighbourhoodLabel
      ),
      filter: (z, f) => {
        return f.props["pmap:kind"] == "neighbourhood";
      },
    },
    {
      dataLayer: "landuse",
      symbolizer: languageStack(
        new PolygonLabelSymbolizer({
          label_props: nametags,
          fill: params.landuseLabel,
          font: "300 12px sans-serif",
        }),
        params.landuseLabel
      ),
    },
    {
      dataLayer: "water",
      symbolizer: languageStack(
        new PolygonLabelSymbolizer({
          label_props: nametags,
          fill: params.waterLabel,
          font: "italic 600 12px sans-serif",
        }),
        params.waterLabel
      ),
    },
    {
      dataLayer: "natural",
      symbolizer: languageStack(
        new PolygonLabelSymbolizer({
          label_props: nametags,
          fill: params.naturalLabel,
          font: "italic 300 12px sans-serif",
        }),
        params.naturalLabel
      ),
    },
    {
      dataLayer: "roads",
      symbolizer: languageStack(
        new LineLabelSymbolizer({
          label_props: nametags,
          fill: params.roadsLabel,
          font: "500 12px sans-serif",
        }),
        params.roadsLabel
      ),
      minzoom: 12,
    },
    {
      dataLayer: "roads",
      symbolizer: new ShieldSymbolizer({
        label_props: ["ref"],
        font: "600 9px sans-serif",
        background: params.highway,
        padding: 2,
        fill: params.neighbourhoodLabel,
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] == "highway";
      },
    },
    {
      dataLayer: "pois",
      symbolizer: new GroupSymbolizer([
        new CircleSymbolizer({
          radius: 2,
          fill: params.poisLabel,
        }),
        languageStack(
          new OffsetTextSymbolizer({
            label_props: nametags,
            fill: params.poisLabel,
            offsetX: 2,
            offsetY: 2,
            font: "300 10px sans-serif",
          }),
          params.poisLabel
        ),
      ]),
    },
  ];
};

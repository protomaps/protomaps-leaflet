import { LabelRule } from "../labeler";
import { Rule } from "../painter";
import { Justify } from "../symbolizer";
import { arr, createPattern, exp } from "../symbolizer";
import { CircleSymbolizer, IconSymbolizer } from "../symbolizer";
import {
  CenteredTextSymbolizer,
  GroupSymbolizer,
  OffsetTextSymbolizer,
} from "../symbolizer";
import { LineLabelSymbolizer, LineSymbolizer } from "../symbolizer";
import { PolygonLabelSymbolizer, PolygonSymbolizer } from "../symbolizer";
import { Font, Sheet } from "../task";
// import icons from './toner-icons.html'

// https://github.com/stamen/toner-carto/blob/master/map.mss

// class MetroSymbolizer implements PaintSymbolizer {
//    stash(index, order, scratch,geom,feature,zoom) {
//         let a = geom[0][0]
//         let bbox = {minX:a.x-6, minY:a.y-6,maxX:a.x+6,maxY:a.y+6}
//         let draw = ctx => {
//             ctx.fillStyle = "black"
//             ctx.fillRect(-6,-6,12,12)
//             ctx.fillStyle = "white"
//             ctx.font = "600 11px Inter"
//             ctx.fillText("M",-5,4)
//         }
//         return [{anchor:a,bboxes:[bbox],draw:draw}]
//     }
// }

interface PlacesFeature {
  "pmap:rank": number;
}

const Toner = (variant: string) => {
  const halftone = createPattern(4, 4, (c) => {
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.rect(0, 0, 1, 1);
      ctx.rect(2, 2, 1, 1);
      ctx.fillStyle = "black";
      ctx.fill();
    }
  });

  let background = "black";
  if (variant === "lite") {
    background = "#d9d9d9";
  }

  const lang = ["name:en", "name"];
  // let sprites = Sprites(icons);

  const paint_rules: Rule[] = [
    {
      dataLayer: "earth",
      symbolizer: new PolygonSymbolizer({
        fill: "white",
      }),
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonSymbolizer({
        pattern: halftone,
      }),
      filter: (z, f) => {
        return f.props.leisure === "park";
      },
    },
    {
      dataLayer: "water",
      symbolizer: new PolygonSymbolizer({
        fill: background,
      }),
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: "#dddddd",
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "minor_road";
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: "white",
        width: arr(16, [7, 9, 17, 20]),
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "medium_road";
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: "#cccccc",
        width: arr(10, [0.2, 0.2, 0.2, 0.4, 0.8, 1.5, 4, 7, 13, 16]),
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "medium_road";
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: "white",
        width: arr(11, [1.25, 5, 5, 5, 8, 11, 18, 22, 30]),
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "major_road";
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: "black",
        width: arr(9, [0.15, 0.5, 0.7, 1, 1.5, 1.9, 5, 7, 12, 18, 26]),
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "major_road";
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: "white",
        width: arr(7, [2.25, 3.25, 4.25, 5, 6, 7, 8, 9, 11, 14, 24, 42, 49]),
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "highway";
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineSymbolizer({
        color: "black",
        width: arr(6, [0.1, 1.5, 1.5, 1.5, 2, 2.5, 3, 3, 4, 6, 9, 15, 28, 35]),
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "highway";
      },
    },
    {
      dataLayer: "transit",
      symbolizer: new LineSymbolizer({
        color: "#888888",
        dashColor: "#888888",
        dash: [1, 4],
        dashWidth: 3,
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "railway";
      },
      minzoom: 14,
    },
    {
      dataLayer: "transit",
      symbolizer: new LineSymbolizer({
        color: "#888888",
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "railway";
      },
      minzoom: 14,
    },
    {
      dataLayer: "buildings",
      symbolizer: new LineSymbolizer({
        color: "#888888",
        width: 0.5,
      }),
    },
    {
      dataLayer: "boundaries",
      symbolizer: new LineSymbolizer({
        color: "black",
        width: 1,
      }),
      maxzoom: 6,
    },
    {
      dataLayer: "boundaries",
      symbolizer: new LineSymbolizer({
        color: "white",
        width: 2.5,
        dash: [3, 1],
        dashWidth: 0.3,
        dashColor: "black",
      }),
      minzoom: 7,
    },
  ];

  const label_rules: LabelRule[] = [
    {
      dataLayer: "places",
      symbolizer: new CenteredTextSymbolizer({
        label_props: lang,
        fill: "black",
        stroke: "white",
        width: 1.5,
        fontFamily: "Inter",
        fontWeight: 300,
        fontSize: 15,
        justify: Justify.Center,
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "country";
      },
    },
    {
      dataLayer: "places",
      symbolizer: new CenteredTextSymbolizer({
        label_props: lang,
        fill: "black",
        stroke: "white",
        width: 2,
        fontFamily: "Inter",
        fontWeight: 300,
        fontSize: 12,
        justify: Justify.Center,
      }),
      filter: (z, f) => {
        return f.props["pmap:kind"] === "state";
      },
    },
    {
      dataLayer: "places",
      symbolizer: new GroupSymbolizer([
        new CircleSymbolizer({
          radius: 2,
          fill: "black",
          stroke: "white",
          width: 2,
        }),
        new OffsetTextSymbolizer({
          label_props: lang,
          offsetX: 3,
          fill: "black",
          stroke: "white",
          width: 1.5,
          fontFamily: "Inter",
          fontWeight: 600,
          fontSize: (z, f) => {
            if (f?.props["pmap:rank"] === 1) return 15;
            return 13;
          },
        }),
      ]),
      sort: (a, b) => {
        return (a as PlacesFeature)["pmap:rank"] - (b as PlacesFeature)["pmap:rank"];
      },
      filter: (z, f) => {
        return f.props["pmap:kind"] === "city";
      },
      maxzoom: 8,
    },
    {
      dataLayer: "places",
      symbolizer: new CenteredTextSymbolizer({
        label_props: lang,
        justify: Justify.Center,
        fill: "black",
        stroke: "white",
        width: 2,
        fontFamily: "Inter",
        fontWeight: 600,
        fontSize: (z, f) => {
          if (f?.props["pmap:rank"] === 1) return 15;
          return 13;
        },
      }),
      sort: (a, b) => {
        return (a as PlacesFeature)["pmap:rank"] - (b as PlacesFeature)["pmap:rank"];
      },
      filter: (z, f) => {
        return f.props["pmap:kind"] === "city";
      },
      minzoom: 9,
    },
    {
      dataLayer: "water",
      symbolizer: new PolygonLabelSymbolizer({
        label_props: lang,
        fill: "white",
        stroke: "black",
        width: 3,
        font: "italic 400 12px Inter",
      }),
    },
    {
      dataLayer: "landuse",
      symbolizer: new PolygonLabelSymbolizer({
        fill: "black",
        stroke: "white",
        width: 2.0,
        font: "italic 400 12px Inter",
      }),
    },
    // {
    //     dataLayer: "pois",
    //     symbolizer: new MetroSymbolizer(),
    //     filter: f => { return f.railway == 'station' }
    // },
    // {
    //     dataLayer: "pois",
    //     symbolizer: new IconSymbolizer({
    //         sprites:sprites,
    //         name:"airplane"
    //     }),
    //     filter: f => { return f.railway == 'station' }
    // },
    {
      dataLayer: "physical_point",
      symbolizer: new CenteredTextSymbolizer({
        label_props: lang,
        fill: "white",
        stroke: "black",
        width: 3,
        font: "italic 600 12px Inter",
        textTransform: "uppercase",
        justify: Justify.Center,
      }),
      filter: (z, f) => {
        return ["ocean", "sea"].includes(f.props.place as string);
      },
    },
    {
      dataLayer: "roads",
      symbolizer: new LineLabelSymbolizer({
        fill: "black",
        stroke: "white",
        width: 2,
        font: "600 14px Inter",
        offset: 4,
      }),
    },
  ];

  return {
    tasks: [
      // sprites.load(),
      Font(
        "Inter",
        "https://cdn.protomaps.com/fonts/woff2/Inter.var.woff2",
        "100 900",
      ),
    ],
    paint_rules: paint_rules,
    label_rules: label_rules,
    attribution:
      'Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>.',
  };
};

export { Toner };

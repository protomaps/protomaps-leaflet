// @ts-ignore
import Point from "@mapbox/point-geometry";
import { Feature, Bbox, GeomType } from "./tilecache";
// @ts-ignore
import { Justify, LabelSymbolizer, TextSymbolizer } from "./symbolizer";
import { NumberAttr } from "./attribute";
import { Label, Layout } from "./labeler";

export enum TextPlacements {
  N = 1,
  NE = 2,
  E = 3,
  SE = 4,
  S = 5,
  SW = 6,
  W = 7,
  NW = 8,
}

export interface OffsetSymbolizerValues {
  offsetX?: number;
  offsetY?: number;
  placements?: TextPlacements[];
  justify?: Justify;
}

type DataDrivenFunction = (
  zoom: number,
  feature: Feature
) => OffsetSymbolizerValues;

export class DataDrivenOffsetSymbolizer implements LabelSymbolizer {
  symbolizer: TextSymbolizer;
  offsetX: number;
  offsetY: number;
  placements: TextPlacements[];
  attrs: DataDrivenFunction;

  constructor(symbolizer: TextSymbolizer, options: any) {
    this.symbolizer = symbolizer;
    this.offsetX = options.offsetX || 0;
    this.offsetY = options.offsetY || 0;
    this.placements = options.placements || [
      TextPlacements.NE,
      TextPlacements.SW,
      TextPlacements.NW,
      TextPlacements.SE,
      TextPlacements.N,
      TextPlacements.S,
      TextPlacements.E,
      TextPlacements.W,
    ];
    this.attrs =
      (options.attrs as DataDrivenFunction) ||
      (() => {
        return {};
      });
  }

  public place(layout: Layout, geom: Point[][], feature: Feature) {
    if (feature.geomType !== GeomType.Point) return undefined;
    let placed = this.symbolizer.place(layout, [[new Point(0, 0)]], feature);
    if (!placed || placed.length == 0) return undefined;

    const anchor = geom[0][0];
    const firstLabel = placed[0];
    const firstLabelBbox = firstLabel.bboxes[0];

    // Overwrite options values via the data driven function if exists
    let offsetXValue = this.offsetX;
    let offsetYValue = this.offsetY;
    let justifyValue = this.symbolizer.justify;
    let placements = this.placements;
    const {
      offsetX: ddOffsetX,
      offsetY: ddOffsetY,
      justify: ddJustify,
      placements: ddPlacements,
    } = this.attrs(layout.zoom, feature) || {};
    if (ddOffsetX) offsetXValue = ddOffsetX;
    if (ddOffsetY) offsetYValue = ddOffsetY;
    if (ddJustify) justifyValue = ddJustify;
    if (ddPlacements) placements = ddPlacements;

    for (let placement of placements) {
      const xAxisOffset = this.computeXAxisOffset(
        offsetXValue,
        firstLabelBbox,
        placement
      );
      const yAxisOffset = this.computeYAxisOffset(
        offsetYValue,
        firstLabelBbox,
        placement
      );
      const justify = this.computeJustify(justifyValue, placement);
      const origin = new Point(xAxisOffset, yAxisOffset);
      return this.placeLabelInPoint(
        anchor,
        origin,
        layout,
        firstLabel,
        justify
      );
    }

    return undefined;
  }

  private getBbox = (anchor: Point, bbOrigin: Point, firstLabelBbox: Bbox) => {
    return {
      minX: anchor.x + bbOrigin.x + firstLabelBbox.minX,
      minY: anchor.y + bbOrigin.y + firstLabelBbox.minY,
      maxX: anchor.x + bbOrigin.x + firstLabelBbox.maxX,
      maxY: anchor.y + bbOrigin.y + firstLabelBbox.maxY,
    };
  }

  private placeLabelInPoint(
    anchor: Point,
    bbOrigin: Point,
    layout: Layout,
    firstLabel: Label,
    justify: Justify
  ) {
    const bbox = this.getBbox(anchor, bbOrigin, firstLabel.bboxes[0]);
    if (!layout.index.bboxCollides(bbox, layout.order))
      return [
        {
          anchor: anchor,
          bboxes: [bbox],
          draw: this.getDrawFunction(bbOrigin, firstLabel, justify),
        },
      ];
  }

  private getDrawFunction(origin: Point, first_label: Label, justify: Justify) {
    return (ctx: any) => {
      ctx.translate(origin.x, origin.y);
      first_label.draw(ctx, { justify: justify });
    };
  }

  private computeXAxisOffset(
    offsetX: number,
    fb: Bbox,
    placement: TextPlacements
  ) {
    const labelWidth = fb.maxX;
    const labelHalfWidth = labelWidth / 2;
    if ([TextPlacements.N, TextPlacements.S].includes(placement))
      return offsetX - labelHalfWidth;
    if (
      [TextPlacements.NW, TextPlacements.W, TextPlacements.SW].includes(
        placement
      )
    )
      return offsetX - labelWidth;
    return offsetX;
  }

  private computeYAxisOffset(
    offsetY: number,
    fb: Bbox,
    placement: TextPlacements
  ) {
    const labelHalfHeight = Math.abs(fb.minY);
    const labelBottom = fb.maxY;
    const labelCenterHeight = (fb.minY + fb.maxY) / 2;
    if ([TextPlacements.E, TextPlacements.W].includes(placement))
      return offsetY - labelCenterHeight;
    if (
      [TextPlacements.NW, TextPlacements.NE, TextPlacements.N].includes(
        placement
      )
    )
      return offsetY - labelBottom;
    if (
      [TextPlacements.SW, TextPlacements.SE, TextPlacements.S].includes(
        placement
      )
    )
      return offsetY + labelHalfHeight;
    return offsetY;
  }

  private computeJustify(fixedJustify: Justify, placement: TextPlacements) {
    if (fixedJustify) return fixedJustify;
    if ([TextPlacements.N, TextPlacements.S].includes(placement))
      return Justify.Center;
    if (
      [TextPlacements.NE, TextPlacements.E, TextPlacements.SE].includes(
        placement
      )
    )
      return Justify.Left;
    return Justify.Right;
  }
}

export class DataDrivenOffsetTextSymbolizer implements LabelSymbolizer {
  symbolizer: LabelSymbolizer;

  constructor(options: any) {
    this.symbolizer = new DataDrivenOffsetSymbolizer(
      new TextSymbolizer(options),
      options
    );
  }

  public place(layout: Layout, geom: Point[][], feature: Feature) {
    return this.symbolizer.place(layout, geom, feature);
  }
}

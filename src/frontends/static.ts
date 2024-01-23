import Point from "@mapbox/point-geometry";

import { PMTiles } from "pmtiles";
import { dark } from "../default_style/dark";
import { light } from "../default_style/light";
import { labelRules, paintRules } from "../default_style/style";
import { LabelRule, Labeler } from "../labeler";
import { Rule, painter } from "../painter";
import { PmtilesSource, TileCache, ZxySource } from "../tilecache";
import { PreparedTile, SourceOptions, View, sourcesToViews } from "../view";
import { XraySelection, xray_rules } from "../xray";

const R = 6378137;
const MAX_LATITUDE = 85.0511287798;
const MAXCOORD = R * Math.PI;

const project = (latlng: Point): Point => {
  const d = Math.PI / 180;
  const constrained_lat = Math.max(
    Math.min(MAX_LATITUDE, latlng.y),
    -MAX_LATITUDE,
  );
  const sin = Math.sin(constrained_lat * d);
  return new Point(R * latlng.x * d, (R * Math.log((1 + sin) / (1 - sin))) / 2);
};

const unproject = (point: Point) => {
  const d = 180 / Math.PI;
  return {
    lat: (2 * Math.atan(Math.exp(point.y / R)) - Math.PI / 2) * d,
    lng: (point.x * d) / R,
  };
};

const instancedProject = (origin: Point, display_zoom: number) => {
  return (latlng: Point) => {
    const projected = project(latlng);
    const normalized = new Point(
      (projected.x + MAXCOORD) / (MAXCOORD * 2),
      1 - (projected.y + MAXCOORD) / (MAXCOORD * 2),
    );
    return normalized.mult((1 << display_zoom) * 256).sub(origin);
  };
};

const instancedUnproject = (origin: Point, display_zoom: number) => {
  return (point: Point) => {
    const normalized = new Point(point.x, point.y)
      .add(origin)
      .div((1 << display_zoom) * 256);
    const projected = new Point(
      normalized.x * (MAXCOORD * 2) - MAXCOORD,
      (1 - normalized.y) * (MAXCOORD * 2) - MAXCOORD,
    );
    return unproject(projected);
  };
};

export const getZoom = (degrees_lng: number, css_pixels: number): number => {
  const d = css_pixels * (360 / degrees_lng);
  return Math.log2(d / 256);
};

interface StaticOptions {
  debug?: string;
  lang?: string;
  shade?: string;
  levelDiff?: number;
  maxDataZoom?: number;
  url?: PMTiles | string;
  sources?: Record<string, SourceOptions>;
  paint_rules?: Rule[];
  dark?: boolean;
  label_rules?: LabelRule[];
  language1?: string[];
  language2?: string[];
  backgroundColor?: string;
  xray?: XraySelection;
}

export class Static {
  paint_rules: Rule[];
  label_rules: LabelRule[];
  views: Map<string, View>;
  debug?: string;
  backgroundColor?: string;
  xray?: XraySelection;

  constructor(options: StaticOptions) {
    const theme = options.dark ? dark : light;
    this.paint_rules = options.paint_rules || paintRules(theme, options.shade);
    this.label_rules =
      options.label_rules ||
      labelRules(theme, options.shade, options.language1, options.language2);
    this.backgroundColor = options.backgroundColor;

    this.views = sourcesToViews(options);
    this.debug = options.debug || "";
    this.xray = options.xray;
  }

  async drawContext(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    latlng: Point,
    display_zoom: number,
  ) {
    const center = project(latlng);
    const normalized_center = new Point(
      (center.x + MAXCOORD) / (MAXCOORD * 2),
      1 - (center.y + MAXCOORD) / (MAXCOORD * 2),
    );

    // the origin of the painter call in global Z coordinates
    const origin = normalized_center
      .clone()
      .mult(2 ** display_zoom * 256)
      .sub(new Point(width / 2, height / 2));

    // the bounds of the painter call in global Z coordinates
    const bbox = {
      minX: origin.x,
      minY: origin.y,
      maxX: origin.x + width,
      maxY: origin.y + height,
    };

    const promises = [];
    for (const [k, v] of this.views) {
      const promise = v.getBbox(display_zoom, bbox);
      promises.push({ key: k, promise: promise });
    }
    const tile_responses = await Promise.all(
      promises.map((o) => {
        return o.promise.then(
          (v: PreparedTile[]) => {
            return { status: "fulfilled", value: v, key: o.key };
          },
          (error: Error) => {
            return { status: "rejected", value: [], reason: error, key: o.key };
          },
        );
      }),
    );

    const prepared_tilemap = new Map<string, PreparedTile[]>();
    for (const tile_response of tile_responses) {
      if (tile_response.status === "fulfilled") {
        prepared_tilemap.set(tile_response.key, tile_response.value);
      }
    }

    const start = performance.now();
    const labeler = new Labeler(
      display_zoom,
      ctx,
      this.label_rules,
      16,
      undefined,
    ); // because need ctx to measure

    const layout_time = labeler.add(prepared_tilemap);

    if (this.backgroundColor) {
      ctx.save();
      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    let paint_rules = this.paint_rules;
    if (this.xray) {
      paint_rules = xray_rules(prepared_tilemap, this.xray);
    }

    const p = painter(
      ctx,
      display_zoom,
      prepared_tilemap,
      this.xray ? null : labeler.index,
      paint_rules,
      bbox,
      origin,
      true,
      this.debug,
    );

    if (this.debug) {
      ctx.save();
      ctx.translate(-origin.x, -origin.y);
      ctx.strokeStyle = this.debug;
      ctx.fillStyle = this.debug;
      ctx.font = "12px sans-serif";
      let idx = 0;
      for (const [k, v] of prepared_tilemap) {
        for (const prepared_tile of v) {
          ctx.strokeRect(
            prepared_tile.origin.x,
            prepared_tile.origin.y,
            prepared_tile.dim,
            prepared_tile.dim,
          );
          const dt = prepared_tile.data_tile;
          ctx.fillText(
            `${k + (k ? " " : "") + dt.z} ${dt.x} ${dt.y}`,
            prepared_tile.origin.x + 4,
            prepared_tile.origin.y + 14 * (1 + idx),
          );
        }
        idx++;
      }
      ctx.restore();
    }

    // TODO this API isn't so elegant
    return {
      elapsed: performance.now() - start,
      project: instancedProject(origin, display_zoom),
      unproject: instancedUnproject(origin, display_zoom),
    };
  }

  async drawCanvas(
    canvas: HTMLCanvasElement,
    latlng: Point,
    display_zoom: number,
    options: StaticOptions = {},
  ) {
    const dpr = window.devicePixelRatio;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!(canvas.width === width * dpr && canvas.height === height * dpr)) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    if (options.lang) canvas.lang = options.lang;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return this.drawContext(ctx, width, height, latlng, display_zoom);
  }

  async drawContextBounds(
    ctx: CanvasRenderingContext2D,
    top_left: Point,
    bottom_right: Point,
    width: number,
    height: number,
  ) {
    const delta_degrees = bottom_right.x - top_left.x;
    const center = new Point(
      (top_left.x + bottom_right.x) / 2,
      (top_left.y + bottom_right.y) / 2,
    );
    return this.drawContext(
      ctx,
      width,
      height,
      center,
      getZoom(delta_degrees, width),
    );
  }

  async drawCanvasBounds(
    canvas: HTMLCanvasElement,
    top_left: Point,
    bottom_right: Point,
    width: number,
    options: StaticOptions = {},
  ) {
    const delta_degrees = bottom_right.x - top_left.x;
    const center = new Point(
      (top_left.x + bottom_right.x) / 2,
      (top_left.y + bottom_right.y) / 2,
    );
    return this.drawCanvas(
      canvas,
      center,
      getZoom(delta_degrees, width),
      options,
    );
  }
}

import Point from "@mapbox/point-geometry";

import { namedFlavor } from "@protomaps/basemaps";
import { PMTiles } from "pmtiles";
import { labelRules, paintRules } from "../default_style/style";
import { LabelRule, Labeler } from "../labeler";
import { PaintRule, paint } from "../painter";
import { PreparedTile, SourceOptions, View, sourcesToViews } from "../view";

const R = 6378137;
const MAX_LATITUDE = 85.0511287798;
const MAXCOORD = R * Math.PI;

const project = (latlng: Point): Point => {
  const d = Math.PI / 180;
  const constrainedLat = Math.max(
    Math.min(MAX_LATITUDE, latlng.y),
    -MAX_LATITUDE,
  );
  const sin = Math.sin(constrainedLat * d);
  return new Point(R * latlng.x * d, (R * Math.log((1 + sin) / (1 - sin))) / 2);
};

const unproject = (point: Point) => {
  const d = 180 / Math.PI;
  return {
    lat: (2 * Math.atan(Math.exp(point.y / R)) - Math.PI / 2) * d,
    lng: (point.x * d) / R,
  };
};

const instancedProject = (origin: Point, displayZoom: number) => {
  return (latlng: Point) => {
    const projected = project(latlng);
    const normalized = new Point(
      (projected.x + MAXCOORD) / (MAXCOORD * 2),
      1 - (projected.y + MAXCOORD) / (MAXCOORD * 2),
    );
    return normalized.mult(2 ** displayZoom * 256).sub(origin);
  };
};

const instancedUnproject = (origin: Point, displayZoom: number) => {
  return (point: Point) => {
    const normalized = new Point(point.x, point.y)
      .add(origin)
      .div(2 ** displayZoom * 256);
    const projected = new Point(
      normalized.x * (MAXCOORD * 2) - MAXCOORD,
      (1 - normalized.y) * (MAXCOORD * 2) - MAXCOORD,
    );
    return unproject(projected);
  };
};

export const getZoom = (degreesLng: number, cssPixels: number): number => {
  const d = cssPixels * (360 / degreesLng);
  return Math.log2(d / 256);
};

interface StaticOptions {
  debug?: string;
  lang?: string;
  maxDataZoom?: number;
  url?: PMTiles | string;
  sources?: Record<string, SourceOptions>;
  paintRules?: PaintRule[];
  labelRules?: LabelRule[];
  backgroundColor?: string;
  flavor?: string;
}

export class Static {
  paintRules: PaintRule[];
  labelRules: LabelRule[];
  views: Map<string, View>;
  debug?: string;
  backgroundColor?: string;

  constructor(options: StaticOptions) {
    if (options.flavor) {
      const flavor = namedFlavor(options.flavor);
      this.paintRules = paintRules(flavor);
      this.labelRules = labelRules(flavor, options.lang || "en");
      this.backgroundColor = flavor.background;
    } else {
      this.paintRules = options.paintRules || [];
      this.labelRules = options.labelRules || [];
      this.backgroundColor = options.backgroundColor;
    }

    this.views = sourcesToViews(options);
    this.debug = options.debug || "";
  }

  async drawContext(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    latlng: Point,
    displayZoom: number,
  ) {
    const center = project(latlng);
    const normalizedCenter = new Point(
      (center.x + MAXCOORD) / (MAXCOORD * 2),
      1 - (center.y + MAXCOORD) / (MAXCOORD * 2),
    );

    // the origin of the painter call in global Z coordinates
    const origin = normalizedCenter
      .clone()
      .mult(2 ** displayZoom * 256)
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
      const promise = v.getBbox(displayZoom, bbox);
      promises.push({ key: k, promise: promise });
    }
    const tileResponses = await Promise.all(
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

    const preparedTilemap = new Map<string, PreparedTile[]>();
    for (const tileResponse of tileResponses) {
      if (tileResponse.status === "fulfilled") {
        preparedTilemap.set(tileResponse.key, tileResponse.value);
      }
    }

    const start = performance.now();
    const labeler = new Labeler(
      displayZoom,
      ctx,
      this.labelRules,
      16,
      undefined,
    ); // because need ctx to measure

    const layoutTime = labeler.add(preparedTilemap);

    if (this.backgroundColor) {
      ctx.save();
      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    const paintRules = this.paintRules;

    const p = paint(
      ctx,
      displayZoom,
      preparedTilemap,
      labeler.index,
      paintRules,
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
      for (const [k, v] of preparedTilemap) {
        for (const preparedTile of v) {
          ctx.strokeRect(
            preparedTile.origin.x,
            preparedTile.origin.y,
            preparedTile.dim,
            preparedTile.dim,
          );
          const dt = preparedTile.dataTile;
          ctx.fillText(
            `${k + (k ? " " : "") + dt.z} ${dt.x} ${dt.y}`,
            preparedTile.origin.x + 4,
            preparedTile.origin.y + 14 * (1 + idx),
          );
        }
        idx++;
      }
      ctx.restore();
    }

    // TODO this API isn't so elegant
    return {
      elapsed: performance.now() - start,
      project: instancedProject(origin, displayZoom),
      unproject: instancedUnproject(origin, displayZoom),
    };
  }

  async drawCanvas(
    canvas: HTMLCanvasElement,
    latlng: Point,
    displayZoom: number,
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
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("Failed to initialize canvas2d context.");
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return this.drawContext(ctx, width, height, latlng, displayZoom);
  }

  async drawContextBounds(
    ctx: CanvasRenderingContext2D,
    topLeft: Point,
    bottomRight: Point,
    width: number,
    height: number,
  ) {
    const deltaDegrees = bottomRight.x - topLeft.x;
    const center = new Point(
      (topLeft.x + bottomRight.x) / 2,
      (topLeft.y + bottomRight.y) / 2,
    );
    return this.drawContext(
      ctx,
      width,
      height,
      center,
      getZoom(deltaDegrees, width),
    );
  }

  async drawCanvasBounds(
    canvas: HTMLCanvasElement,
    topLeft: Point,
    bottomRight: Point,
    width: number,
    options: StaticOptions = {},
  ) {
    const deltaDegrees = bottomRight.x - topLeft.x;
    const center = new Point(
      (topLeft.x + bottomRight.x) / 2,
      (topLeft.y + bottomRight.y) / 2,
    );
    return this.drawCanvas(
      canvas,
      center,
      getZoom(deltaDegrees, width),
      options,
    );
  }
}

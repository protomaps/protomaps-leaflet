// biome-ignore lint: leaflet 1.x
declare const L: any;

import Point from "@mapbox/point-geometry";

import type { Coords } from "leaflet";
import { namedFlavor } from "@protomaps/basemaps";
import { PMTiles } from "pmtiles";
import { labelRules, paintRules } from "../default_style/style";
import { LabelRule, Labelers } from "../labeler";
import { PaintRule, paint } from "../painter";
import { PickedFeature } from "../tilecache";
import { PreparedTile, SourceOptions, sourcesToViews } from "../view";

const timer = (duration: number) => {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, duration);
  });
};

// replacement for Promise.allSettled (requires ES2020+)
// this is called for every tile render,
// so ensure font loading failure does not make map rendering fail
type Status = {
  status: string;
  value?: unknown;
  reason: Error;
};

const reflect = (promise: Promise<Status>) => {
  return promise.then(
    (v) => {
      return { status: "fulfilled", value: v };
    },
    (error) => {
      return { status: "rejected", reason: error };
    },
  );
};

type DoneCallback = (error?: Error, tile?: HTMLElement) => void;
type KeyedHtmlCanvasElement = HTMLCanvasElement & { key: string };

export interface LeafletLayerOptions extends L.GridLayerOptions {
  bounds?: L.LatLngBoundsExpression;
  attribution?: string;
  debug?: string;
  lang?: string;
  tileDelay?: number;
  noWrap?: boolean;
  paintRules?: PaintRule[];
  labelRules?: LabelRule[];
  tasks?: Promise<Status>[];
  maxDataZoom?: number;
  url?: PMTiles | string;
  sources?: Record<string, SourceOptions>;
  flavor?: string;
  backgroundColor?: string;
  devicePixelRatio?: number;
}

const leafletLayer = (options: LeafletLayerOptions = {}) => {
  class LeafletLayer extends L.GridLayer {
    public paintRules: PaintRule[];
    public labelRules: LabelRule[];
    public backgroundColor?: string;
    public devicePixelRatio: number;

    constructor(options: LeafletLayerOptions = {}) {
      if (options.noWrap && !options.bounds)
        options.bounds = [
          [-90, -180],
          [90, 180],
        ];
      if (options.attribution == null)
        options.attribution =
          '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>';
      super(options);

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

      this.devicePixelRatio =
        options.devicePixelRatio ?? window.devicePixelRatio;

      this.lastRequestedZ = undefined;
      this.tasks = options.tasks || [];

      this.views = sourcesToViews(options);

      this.debug = options.debug;
      const scratch = document.createElement("canvas").getContext("2d");
      this.scratch = scratch;
      this.onTilesInvalidated = (tiles: Set<string>) => {
        for (const t of tiles) {
          this.rerenderTile(t);
        }
      };
      this.labelers = new Labelers(
        this.scratch,
        this.labelRules,
        16,
        this.onTilesInvalidated,
      );
      this.tileSize = 256 * this.devicePixelRatio;
      this.tileDelay = options.tileDelay || 3;
      this.lang = options.lang;
    }

    public async renderTile(
      coords: Coords,
      element: KeyedHtmlCanvasElement,
      key: string,
      done = () => {},
    ) {
      this.lastRequestedZ = coords.z;

      const promises = [];
      for (const [k, v] of this.views) {
        const promise = v.getDisplayTile(coords);
        promises.push({ key: k, promise: promise });
      }
      const tileResponses = await Promise.all(
        promises.map((o) => {
          return o.promise.then(
            (v: PreparedTile[]) => {
              return { status: "fulfilled", value: v, key: o.key };
            },
            (error: Error) => {
              return { status: "rejected", reason: error, key: o.key };
            },
          );
        }),
      );

      const preparedTilemap = new Map<string, PreparedTile[]>();
      for (const tileResponse of tileResponses) {
        if (tileResponse.status === "fulfilled") {
          preparedTilemap.set(tileResponse.key, [tileResponse.value]);
        } else {
          if (tileResponse.reason.name === "AbortError") {
            // do nothing
          } else {
            console.error(tileResponse.reason);
          }
        }
      }

      if (element.key !== key) return;
      if (this.lastRequestedZ !== coords.z) return;

      await Promise.all(this.tasks.map(reflect));

      if (element.key !== key) return;
      if (this.lastRequestedZ !== coords.z) return;

      const layoutTime = this.labelers.add(coords.z, preparedTilemap);

      if (element.key !== key) return;
      if (this.lastRequestedZ !== coords.z) return;

      const labelData = this.labelers.getIndex(coords.z);

      if (!this._map) return; // the layer has been removed from the map

      const center = this._map.getCenter().wrap();
      const pixelBounds = this._getTiledPixelBounds(center);
      const tileRange = this._pxBoundsToTileRange(pixelBounds);
      const tileCenter = tileRange.getCenter();
      const priority = coords.distanceTo(tileCenter) * this.tileDelay;

      await timer(priority);

      if (element.key !== key) return;
      if (this.lastRequestedZ !== coords.z) return;

      const buf = 16;
      const bbox = {
        minX: 256 * coords.x - buf,
        minY: 256 * coords.y - buf,
        maxX: 256 * (coords.x + 1) + buf,
        maxY: 256 * (coords.y + 1) + buf,
      };
      const origin = new Point(256 * coords.x, 256 * coords.y);

      element.width = this.tileSize;
      element.height = this.tileSize;
      const ctx = element.getContext("2d");
      if (!ctx) {
        console.error("Failed to get Canvas context");
        return;
      }
      ctx.setTransform(this.tileSize / 256, 0, 0, this.tileSize / 256, 0, 0);
      ctx.clearRect(0, 0, 256, 256);

      if (this.backgroundColor) {
        ctx.save();
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(0, 0, 256, 256);
        ctx.restore();
      }

      let paintingTime = 0;

      const paintRules = this.paintRules;

      paintingTime = paint(
        ctx,
        coords.z,
        preparedTilemap,
        this.xray ? null : labelData,
        paintRules,
        bbox,
        origin,
        false,
        this.debug,
      );

      if (this.debug) {
        ctx.save();
        ctx.fillStyle = this.debug;
        ctx.font = "600 12px sans-serif";
        ctx.fillText(`${coords.z} ${coords.x} ${coords.y}`, 4, 14);

        ctx.font = "12px sans-serif";
        let ypos = 28;
        for (const [k, v] of preparedTilemap) {
          const dt = v[0].dataTile;
          ctx.fillText(`${k + (k ? " " : "") + dt.z} ${dt.x} ${dt.y}`, 4, ypos);
          ypos += 14;
        }

        ctx.font = "600 10px sans-serif";
        if (paintingTime > 8) {
          ctx.fillText(`${paintingTime.toFixed()} ms paint`, 4, ypos);
          ypos += 14;
        }

        if (layoutTime > 8) {
          ctx.fillText(`${layoutTime.toFixed()} ms layout`, 4, ypos);
        }
        ctx.strokeStyle = this.debug;

        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 256);
        ctx.stroke();

        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(256, 0);
        ctx.stroke();

        ctx.restore();
      }
      done();
    }

    public rerenderTile(key: string) {
      for (const unwrappedK in this._tiles) {
        const wrappedCoord = this._wrapCoords(
          this._keyToTileCoords(unwrappedK),
        );
        if (key === this._tileCoordsToKey(wrappedCoord)) {
          this.renderTile(wrappedCoord, this._tiles[unwrappedK].el, key);
        }
      }
    }

    // a primitive way to check the features at a certain point.
    // it does not support hover states, cursor changes, or changing the style of the selected feature,
    // so is only appropriate for debugging or very basic use cases.
    // those features are outside of the scope of this library:
    // for fully pickable, interactive features, use MapLibre GL JS instead.
    public queryTileFeaturesDebug(
      lng: number,
      lat: number,
      brushSize = 16,
    ): Map<string, PickedFeature[]> {
      const featuresBySourceName = new Map<string, PickedFeature[]>();
      for (const [sourceName, view] of this.views) {
        featuresBySourceName.set(
          sourceName,
          view.queryFeatures(lng, lat, this._map.getZoom(), brushSize),
        );
      }
      return featuresBySourceName;
    }

    public clearLayout() {
      this.labelers = new Labelers(
        this.scratch,
        this.labelRules,
        16,
        this.onTilesInvalidated,
      );
    }

    public rerenderTiles() {
      for (const unwrappedK in this._tiles) {
        const wrappedCoord = this._wrapCoords(
          this._keyToTileCoords(unwrappedK),
        );
        const key = this._tileCoordsToKey(wrappedCoord);
        this.renderTile(wrappedCoord, this._tiles[unwrappedK].el, key);
      }
    }

    public createTile(coords: Coords, showTile: DoneCallback) {
      const element = L.DomUtil.create("canvas", "leaflet-tile");
      element.lang = this.lang;

      const key = this._tileCoordsToKey(coords);
      element.key = key;

      this.renderTile(coords, element, key, () => {
        showTile(undefined, element);
      });

      return element;
    }

    public _removeTile(key: string) {
      const tile = this._tiles[key];
      if (!tile) {
        return;
      }
      tile.el.removed = true;
      tile.el.key = undefined;
      L.DomUtil.removeClass(tile.el, "leaflet-tile-loaded");
      tile.el.width = tile.el.height = 0;
      L.DomUtil.remove(tile.el);
      delete this._tiles[key];
      this.fire("tileunload", {
        tile: tile.el,
        coords: this._keyToTileCoords(key),
      });
    }
  }
  return new LeafletLayer(options);
};

export { leafletLayer };

// biome-ignore lint: leaflet 1.x
declare const L: any;

import Point from "@mapbox/point-geometry";

import type { Coords } from "leaflet";
import { PMTiles } from "pmtiles";
import { dark } from "../default_style/dark";
import { light } from "../default_style/light";
import { labelRules, paintRules } from "../default_style/style";
import { LabelRule, Labelers } from "../labeler";
import { Rule, painter } from "../painter";
import { TileCache, Zxy } from "../tilecache";
import { PreparedTile, SourceOptions, View, sourcesToViews } from "../view";

const timer = (duration: number) => {
  return new Promise<void>((resolve, reject) => {
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
type KeyedHTMLCanvasElement = HTMLCanvasElement & { key: string };

interface LeafletLayerOptions {
  bounds?: number[][];
  attribution?: string;
  debug?: string;
  lang?: string;
  tileDelay?: number;
  backgroundColor?: string;
  language1?: string[];
  language2?: string[];
  dark?: boolean;
  noWrap?: boolean;
  paint_rules?: Rule[];
  label_rules?: LabelRule[];
  tasks?: Promise<Status>[];

  levelDiff?: number;
  maxDataZoom?: number;
  url?: PMTiles | string;
  sources?: Record<string, SourceOptions>;
}

const leafletLayer = (options: LeafletLayerOptions = {}): unknown => {
  class LeafletLayer extends L.GridLayer {
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

      const theme = options.dark ? dark : light;
      this.paint_rules = options.paint_rules || paintRules(theme);
      this.label_rules =
        options.label_rules ||
        labelRules(theme, options.language1, options.language2);
      this.backgroundColor = options.backgroundColor;
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
        this.label_rules,
        16,
        this.onTilesInvalidated,
      );
      this.tile_size = 256 * window.devicePixelRatio;
      this.tileDelay = options.tileDelay || 3;
      this.lang = options.lang;
    }

    public setDefaultStyle(
      darkOption: boolean,
      language1: string[],
      language2: string[],
    ) {
      const theme = darkOption ? dark : light;
      this.paint_rules = paintRules(theme);
      this.label_rules = labelRules(theme, language1, language2);
    }

    public async renderTile(
      coords: Coords,
      element: KeyedHTMLCanvasElement,
      key: string,
      done = () => {},
    ) {
      this.lastRequestedZ = coords.z;

      const promises = [];
      for (const [k, v] of this.views) {
        const promise = v.getDisplayTile(coords);
        promises.push({ key: k, promise: promise });
      }
      const tile_responses = await Promise.all(
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

      const prepared_tilemap = new Map<string, PreparedTile[]>();
      for (const tile_response of tile_responses) {
        if (tile_response.status === "fulfilled") {
          prepared_tilemap.set(tile_response.key, [tile_response.value]);
        } else {
          if (tile_response.reason.name === "AbortError") {
            // do nothing
          } else {
            console.error(tile_response.reason);
          }
        }
      }

      if (element.key !== key) return;
      if (this.lastRequestedZ !== coords.z) return;

      await Promise.all(this.tasks.map(reflect));

      if (element.key !== key) return;
      if (this.lastRequestedZ !== coords.z) return;

      const layout_time = this.labelers.add(coords.z, prepared_tilemap);

      if (element.key !== key) return;
      if (this.lastRequestedZ !== coords.z) return;

      const label_data = this.labelers.getIndex(coords.z);

      if (!this._map) return; // the layer has been removed from the map

      const center = this._map.getCenter().wrap();
      const pixelBounds = this._getTiledPixelBounds(center);
      const tileRange = this._pxBoundsToTileRange(pixelBounds);
      const tileCenter = tileRange.getCenter();
      const priority = coords.distanceTo(tileCenter) * this.tileDelay;

      await timer(priority);

      if (element.key !== key) return;
      if (this.lastRequestedZ !== coords.z) return;

      const BUF = 16;
      const bbox = {
        minX: 256 * coords.x - BUF,
        minY: 256 * coords.y - BUF,
        maxX: 256 * (coords.x + 1) + BUF,
        maxY: 256 * (coords.y + 1) + BUF,
      };
      const origin = new Point(256 * coords.x, 256 * coords.y);

      element.width = this.tile_size;
      element.height = this.tile_size;
      const ctx = element.getContext("2d");
      if (!ctx) {
        console.error("Failed to get Canvas context");
        return;
      }
      ctx.setTransform(this.tile_size / 256, 0, 0, this.tile_size / 256, 0, 0);
      ctx.clearRect(0, 0, 256, 256);

      if (this.backgroundColor) {
        ctx.save();
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(0, 0, 256, 256);
        ctx.restore();
      }

      let painting_time = 0;

      const paint_rules = this.paint_rules;

      painting_time = painter(
        ctx,
        coords.z,
        prepared_tilemap,
        this.xray ? null : label_data,
        paint_rules,
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
        for (const [k, v] of prepared_tilemap) {
          const dt = v[0].data_tile;
          ctx.fillText(`${k + (k ? " " : "") + dt.z} ${dt.x} ${dt.y}`, 4, ypos);
          ypos += 14;
        }

        ctx.font = "600 10px sans-serif";
        if (painting_time > 8) {
          ctx.fillText(`${painting_time.toFixed()} ms paint`, 4, ypos);
          ypos += 14;
        }

        if (layout_time > 8) {
          ctx.fillText(`${layout_time.toFixed()} ms layout`, 4, ypos);
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
      for (const unwrapped_k in this._tiles) {
        const wrapped_coord = this._wrapCoords(
          this._keyToTileCoords(unwrapped_k),
        );
        if (key === this._tileCoordsToKey(wrapped_coord)) {
          this.renderTile(wrapped_coord, this._tiles[unwrapped_k].el, key);
        }
      }
    }

    public clearLayout() {
      this.labelers = new Labelers(
        this.scratch,
        this.label_rules,
        16,
        this.onTilesInvalidated,
      );
    }

    public rerenderTiles() {
      for (const unwrapped_k in this._tiles) {
        const wrapped_coord = this._wrapCoords(
          this._keyToTileCoords(unwrapped_k),
        );
        const key = this._tileCoordsToKey(wrapped_coord);
        this.renderTile(wrapped_coord, this._tiles[unwrapped_k].el, key);
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

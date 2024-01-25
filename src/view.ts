import Point from "@mapbox/point-geometry";
import { PMTiles } from "pmtiles";
import {
  Bbox,
  Feature,
  PmtilesSource,
  TileCache,
  TileSource,
  Zxy,
  ZxySource,
} from "./tilecache";

/*
 * PreparedTile
 * For a given display Z:
 * layers: map of names-> features with coordinates in CSS pixel units.
 * translate: how to get layers coordinates to global Z coordinates.
 * data_tile: the Z,X,Y of the data tile.
 * window? if present, use as bounding box or canvas clipping area.
 */
export interface PreparedTile {
  z: number; // the display zoom level that it is for
  origin: Point; // the top-left corner in global CSS pixel coordinates
  data: Map<string, Feature[]>; // return a map to Iterable
  scale: number; // over or underzooming scale
  dim: number; // the effective size of this tile on the zoom level
  data_tile: Zxy; // the key of the raw tile
}

export interface TileTransform {
  data_tile: Zxy;
  origin: Point;
  scale: number;
  dim: number;
}

// TODO make this lazy
export const transformGeom = (
  geom: Array<Array<Point>>,
  scale: number,
  translate: Point,
) => {
  const retval = [];
  for (const arr of geom) {
    const loop = [];
    for (const coord of arr) {
      loop.push(coord.clone().mult(scale).add(translate));
    }
    retval.push(loop);
  }
  return retval;
};

export const wrap = (val: number, z: number) => {
  const dim = 1 << z;
  if (val < 0) return dim + val;
  if (val >= dim) return val % dim;
  return val;
};

/*
 * @class View
 * expresses relationship between canvas coordinates and data tiles.
 */
export class View {
  levelDiff: number;
  tileCache: TileCache;
  maxDataLevel: number;

  constructor(tileCache: TileCache, maxDataLevel: number, levelDiff: number) {
    this.tileCache = tileCache;
    this.maxDataLevel = maxDataLevel;
    this.levelDiff = levelDiff;
  }

  public dataTilesForBounds(
    display_zoom: number,
    bounds: Bbox,
  ): Array<TileTransform> {
    const fractional = 2 ** display_zoom / 2 ** Math.ceil(display_zoom);
    const needed = [];
    let scale = 1;
    const dim = this.tileCache.tileSize;
    if (display_zoom < this.levelDiff) {
      scale = (1 / (1 << (this.levelDiff - display_zoom))) * fractional;
      needed.push({
        data_tile: { z: 0, x: 0, y: 0 },
        origin: new Point(0, 0),
        scale: scale,
        dim: dim * scale,
      });
    } else if (display_zoom <= this.levelDiff + this.maxDataLevel) {
      const f = 1 << this.levelDiff;

      const basetile_size = 256 * fractional;

      const data_zoom = Math.ceil(display_zoom) - this.levelDiff;

      const mintile_x = Math.floor(bounds.minX / f / basetile_size);
      const mintile_y = Math.floor(bounds.minY / f / basetile_size);
      const maxtile_x = Math.floor(bounds.maxX / f / basetile_size);
      const maxtile_y = Math.floor(bounds.maxY / f / basetile_size);
      for (let tx = mintile_x; tx <= maxtile_x; tx++) {
        for (let ty = mintile_y; ty <= maxtile_y; ty++) {
          const origin = new Point(
            tx * f * basetile_size,
            ty * f * basetile_size,
          );
          needed.push({
            data_tile: {
              z: data_zoom,
              x: wrap(tx, data_zoom),
              y: wrap(ty, data_zoom),
            },
            origin: origin,
            scale: fractional,
            dim: dim * fractional,
          });
        }
      }
    } else {
      const f = 1 << this.levelDiff;
      scale =
        (1 << (Math.ceil(display_zoom) - this.maxDataLevel - this.levelDiff)) *
        fractional;
      const mintile_x = Math.floor(bounds.minX / f / 256 / scale);
      const mintile_y = Math.floor(bounds.minY / f / 256 / scale);
      const maxtile_x = Math.floor(bounds.maxX / f / 256 / scale);
      const maxtile_y = Math.floor(bounds.maxY / f / 256 / scale);
      for (let tx = mintile_x; tx <= maxtile_x; tx++) {
        for (let ty = mintile_y; ty <= maxtile_y; ty++) {
          const origin = new Point(tx * f * 256 * scale, ty * f * 256 * scale);
          needed.push({
            data_tile: {
              z: this.maxDataLevel,
              x: wrap(tx, this.maxDataLevel),
              y: wrap(ty, this.maxDataLevel),
            },
            origin: origin,
            scale: scale,
            dim: dim * scale,
          });
        }
      }
    }
    return needed;
  }

  public dataTileForDisplayTile(display_tile: Zxy): TileTransform {
    let data_tile: Zxy;
    let scale = 1;
    let dim = this.tileCache.tileSize;
    let origin: Point;
    if (display_tile.z < this.levelDiff) {
      data_tile = { z: 0, x: 0, y: 0 };
      scale = 1 / (1 << (this.levelDiff - display_tile.z));
      origin = new Point(0, 0);
      dim = dim * scale;
    } else if (display_tile.z <= this.levelDiff + this.maxDataLevel) {
      const f = 1 << this.levelDiff;
      data_tile = {
        z: display_tile.z - this.levelDiff,
        x: Math.floor(display_tile.x / f),
        y: Math.floor(display_tile.y / f),
      };
      origin = new Point(data_tile.x * f * 256, data_tile.y * f * 256);
    } else {
      scale = 1 << (display_tile.z - this.maxDataLevel - this.levelDiff);
      const f = 1 << this.levelDiff;
      data_tile = {
        z: this.maxDataLevel,
        x: Math.floor(display_tile.x / f / scale),
        y: Math.floor(display_tile.y / f / scale),
      };
      origin = new Point(
        data_tile.x * f * scale * 256,
        data_tile.y * f * scale * 256,
      );
      dim = dim * scale;
    }
    return { data_tile: data_tile, scale: scale, origin: origin, dim: dim };
  }

  public async getBbox(
    display_zoom: number,
    bounds: Bbox,
  ): Promise<Array<PreparedTile>> {
    const needed = this.dataTilesForBounds(display_zoom, bounds);
    const result = await Promise.all(
      needed.map((tt) => this.tileCache.get(tt.data_tile)),
    );
    return result.map((data, i) => {
      const tt = needed[i];
      return {
        data: data,
        z: display_zoom,
        data_tile: tt.data_tile,
        scale: tt.scale,
        dim: tt.dim,
        origin: tt.origin,
      };
    });
  }

  public async getDisplayTile(display_tile: Zxy): Promise<PreparedTile> {
    const tt = this.dataTileForDisplayTile(display_tile);
    const data = await this.tileCache.get(tt.data_tile);
    return {
      data: data,
      z: display_tile.z,
      data_tile: tt.data_tile,
      scale: tt.scale,
      origin: tt.origin,
      dim: tt.dim,
    };
  }

  public queryFeatures(lng: number, lat: number, display_zoom: number) {
    const rounded_zoom = Math.round(display_zoom);
    const data_zoom = Math.min(
      rounded_zoom - this.levelDiff,
      this.maxDataLevel,
    );
    const brush_size = 16 / (1 << (rounded_zoom - data_zoom));
    return this.tileCache.queryFeatures(lng, lat, data_zoom, brush_size);
  }
}

export interface SourceOptions {
  levelDiff?: number;
  maxDataZoom?: number;
  url?: PMTiles | string;
  sources?: Record<string, SourceOptions>;
}

export const sourcesToViews = (options: SourceOptions) => {
  const sourceToViews = (o: SourceOptions): View => {
    const level_diff = o.levelDiff === undefined ? 2 : o.levelDiff;
    const maxDataZoom = o.maxDataZoom || 14;
    let source: TileSource;
    if (typeof o.url === "string") {
      if (o.url.endsWith(".pmtiles")) {
        source = new PmtilesSource(o.url, true);
      } else {
        source = new ZxySource(o.url, true);
      }
    } else if (o.url) {
      source = new PmtilesSource(o.url, true);
    } else {
      throw new Error(`Invalid source ${o.url}`);
    }

    const cache = new TileCache(source, (256 * 1) << level_diff);
    return new View(cache, maxDataZoom, level_diff);
  };

  const sources = new Map<string, View>();
  if (options.sources) {
    for (const key in options.sources) {
      sources.set(key, sourceToViews(options.sources[key]));
    }
  } else {
    sources.set("", sourceToViews(options));
  }
  return sources;
};

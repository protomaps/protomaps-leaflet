import Point from "@mapbox/point-geometry";
import {
  Zxy,
  TileCache,
  Feature,
  Bbox,
  ZxySource,
  PmtilesSource,
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
  translate: Point
) => {
  let retval = [];
  for (let arr of geom) {
    let loop = [];
    for (let coord of arr) {
      loop.push(coord.clone().mult(scale).add(translate));
    }
    retval.push(loop);
  }
  return retval;
};

export const wrap = (val: number, z: number) => {
  let dim = 1 << z;
  if (val < 0) val = dim + val;
  if (val >= dim) val = val % dim;
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
    bounds: any
  ): Array<TileTransform> {
    let fractional =
      Math.pow(2, display_zoom) / Math.pow(2, Math.ceil(display_zoom));
    let needed = [];
    var scale = 1;
    var dim = this.tileCache.tileSize;
    if (display_zoom < this.levelDiff) {
      scale = (1 / (1 << (this.levelDiff - display_zoom))) * fractional;
      needed.push({
        data_tile: { z: 0, x: 0, y: 0 },
        origin: new Point(0, 0),
        scale: scale,
        dim: dim * scale,
      });
    } else if (display_zoom <= this.levelDiff + this.maxDataLevel) {
      let f = 1 << this.levelDiff;

      let basetile_size = 256 * fractional;

      let data_zoom = Math.ceil(display_zoom) - this.levelDiff;

      let mintile_x = Math.floor(bounds.minX / f / basetile_size);
      let mintile_y = Math.floor(bounds.minY / f / basetile_size);
      let maxtile_x = Math.floor(bounds.maxX / f / basetile_size);
      let maxtile_y = Math.floor(bounds.maxY / f / basetile_size);
      for (var tx = mintile_x; tx <= maxtile_x; tx++) {
        for (var ty = mintile_y; ty <= maxtile_y; ty++) {
          let origin = new Point(
            tx * f * basetile_size,
            ty * f * basetile_size
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
      let f = 1 << this.levelDiff;
      scale =
        (1 << (Math.ceil(display_zoom) - this.maxDataLevel - this.levelDiff)) *
        fractional;
      let mintile_x = Math.floor(bounds.minX / f / 256 / scale);
      let mintile_y = Math.floor(bounds.minY / f / 256 / scale);
      let maxtile_x = Math.floor(bounds.maxX / f / 256 / scale);
      let maxtile_y = Math.floor(bounds.maxY / f / 256 / scale);
      for (var tx = mintile_x; tx <= maxtile_x; tx++) {
        for (var ty = mintile_y; ty <= maxtile_y; ty++) {
          let origin = new Point(tx * f * 256 * scale, ty * f * 256 * scale);
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
    var data_tile: Zxy;
    var scale = 1;
    var dim = this.tileCache.tileSize;
    var origin: Point;
    if (display_tile.z < this.levelDiff) {
      data_tile = { z: 0, x: 0, y: 0 };
      scale = 1 / (1 << (this.levelDiff - display_tile.z));
      origin = new Point(0, 0);
      dim = dim * scale;
    } else if (display_tile.z <= this.levelDiff + this.maxDataLevel) {
      let f = 1 << this.levelDiff;
      data_tile = {
        z: display_tile.z - this.levelDiff,
        x: Math.floor(display_tile.x / f),
        y: Math.floor(display_tile.y / f),
      };
      origin = new Point(data_tile.x * f * 256, data_tile.y * f * 256);
    } else {
      scale = 1 << (display_tile.z - this.maxDataLevel - this.levelDiff);
      let f = 1 << this.levelDiff;
      data_tile = {
        z: this.maxDataLevel,
        x: Math.floor(display_tile.x / f / scale),
        y: Math.floor(display_tile.y / f / scale),
      };
      origin = new Point(
        data_tile.x * f * scale * 256,
        data_tile.y * f * scale * 256
      );
      dim = dim * scale;
    }
    return { data_tile: data_tile, scale: scale, origin: origin, dim: dim };
  }

  public async getBbox(
    display_zoom: number,
    bounds: Bbox
  ): Promise<Array<PreparedTile>> {
    let needed = this.dataTilesForBounds(display_zoom, bounds);
    let result = await Promise.all(
      needed.map((tt) => this.tileCache.get(tt.data_tile))
    );
    return result.map((data, i) => {
      let tt = needed[i];
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
    let tt = this.dataTileForDisplayTile(display_tile);
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
    let rounded_zoom = Math.round(display_zoom);
    let data_zoom = Math.min(rounded_zoom - this.levelDiff, this.maxDataLevel);
    let brush_size = 16 / (1 << (rounded_zoom - data_zoom));
    return this.tileCache.queryFeatures(lng, lat, data_zoom, brush_size);
  }
}

export let sourcesToViews = (options: any) => {
  let sourceToViews = (o: any) => {
    let level_diff = o.levelDiff === undefined ? 2 : o.levelDiff;
    let maxDataZoom = o.maxDataZoom || 14;
    let source;
    if (o.url.url) {
      source = new PmtilesSource(o.url, true);
    } else if (o.url.endsWith(".pmtiles")) {
      source = new PmtilesSource(o.url, true);
    } else {
      source = new ZxySource(o.url, true);
    }
    let cache = new TileCache(source, (256 * 1) << level_diff);
    return new View(cache, maxDataZoom, level_diff);
  };

  let sources = new Map<string, View>();
  if (options.sources) {
    for (const [key, value] of Object.entries(options.sources)) {
      sources.set(key, sourceToViews(value));
    }
  } else {
    sources.set("", sourceToViews(options));
  }
  return sources;
};

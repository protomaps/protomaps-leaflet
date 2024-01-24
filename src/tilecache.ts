import Point from "@mapbox/point-geometry";
import { VectorTile } from "@mapbox/vector-tile";
import Protobuf from "pbf";
import { PMTiles } from "pmtiles";

export type JsonValue =
  | boolean
  | number
  | string
  | null
  | JsonArray
  | JsonObject;
export interface JsonObject {
  [key: string]: JsonValue;
}
export interface JsonArray extends Array<JsonValue> {}

export enum GeomType {
  Point = 1,
  Line = 2,
  Polygon = 3,
}

export interface Bbox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Feature {
  readonly props: JsonObject;
  readonly bbox: Bbox;
  readonly geomType: GeomType;
  readonly geom: Point[][];
  readonly numVertices: number;
}

export interface Zxy {
  readonly z: number;
  readonly x: number;
  readonly y: number;
}

export function toIndex(c: Zxy): string {
  return `${c.x}:${c.y}:${c.z}`;
}

export interface TileSource {
  get(c: Zxy, tileSize: number): Promise<Map<string, Feature[]>>;
}

interface ZoomAbort {
  z: number;
  controller: AbortController;
}

// reimplement loadGeometry with a scalefactor
// so the general tile rendering case does not need rescaling.
const loadGeomAndBbox = (pbf: Protobuf, geometry: number, scale: number) => {
  pbf.pos = geometry;
  const end = pbf.readVarint() + pbf.pos;
  let cmd = 1;
  let length = 0;
  let x = 0;
  let y = 0;
  let x1 = Infinity;
  let x2 = -Infinity;
  let y1 = Infinity;
  let y2 = -Infinity;

  const lines: Point[][] = [];
  let line: Point[] = [];
  while (pbf.pos < end) {
    if (length <= 0) {
      const cmdLen = pbf.readVarint();
      cmd = cmdLen & 0x7;
      length = cmdLen >> 3;
    }
    length--;
    if (cmd === 1 || cmd === 2) {
      x += pbf.readSVarint() * scale;
      y += pbf.readSVarint() * scale;
      if (x < x1) x1 = x;
      if (x > x2) x2 = x;
      if (y < y1) y1 = y;
      if (y > y2) y2 = y;
      if (cmd === 1) {
        if (line.length > 0) lines.push(line);
        line = [];
      }
      line.push(new Point(x, y));
    } else if (cmd === 7) {
      if (line) line.push(line[0].clone());
    } else throw new Error(`unknown command ${cmd}`);
  }
  if (line) lines.push(line);
  return { geom: lines, bbox: { minX: x1, minY: y1, maxX: x2, maxY: y2 } };
};

function parseTile(
  buffer: ArrayBuffer,
  tileSize: number,
): Map<string, Feature[]> {
  const v = new VectorTile(new Protobuf(buffer));
  const result = new Map<string, Feature[]>();
  for (const [key, value] of Object.entries(v.layers)) {
    const features = [];
    const layer = value as any;
    for (let i = 0; i < layer.length; i++) {
      const loaded = loadGeomAndBbox(
        layer.feature(i)._pbf,
        layer.feature(i)._geometry,
        tileSize / layer.extent,
      );
      let numVertices = 0;
      for (const part of loaded.geom) numVertices += part.length;
      features.push({
        id: layer.feature(i).id,
        geomType: layer.feature(i).type,
        geom: loaded.geom,
        numVertices: numVertices,
        bbox: loaded.bbox,
        props: layer.feature(i).properties,
      });
    }
    result.set(key, features);
  }
  return result;
}

export class PmtilesSource implements TileSource {
  p: PMTiles;
  zoomaborts: ZoomAbort[];
  shouldCancelZooms: boolean;

  constructor(url: string | PMTiles, shouldCancelZooms: boolean) {
    if (typeof url === "string") {
      this.p = new PMTiles(url);
    } else {
      this.p = url;
    }
    this.zoomaborts = [];
    this.shouldCancelZooms = shouldCancelZooms;
  }

  public async get(c: Zxy, tileSize: number): Promise<Map<string, Feature[]>> {
    if (this.shouldCancelZooms) {
      this.zoomaborts = this.zoomaborts.filter((za) => {
        if (za.z !== c.z) {
          za.controller.abort();
          return false;
        }
        return true;
      });
    }
    const controller = new AbortController();
    this.zoomaborts.push({ z: c.z, controller: controller });
    const signal = controller.signal;

    const result = await this.p.getZxy(c.z, c.x, c.y, signal);

    if (result) {
      return parseTile(result.data, tileSize);
    }
    return new Map<string, Feature[]>();
  }
}

export class ZxySource implements TileSource {
  url: string;
  zoomaborts: ZoomAbort[];
  shouldCancelZooms: boolean;

  constructor(url: string, shouldCancelZooms: boolean) {
    this.url = url;
    this.zoomaborts = [];
    this.shouldCancelZooms = shouldCancelZooms;
  }

  public async get(c: Zxy, tileSize: number): Promise<Map<string, Feature[]>> {
    if (this.shouldCancelZooms) {
      this.zoomaborts = this.zoomaborts.filter((za) => {
        if (za.z !== c.z) {
          za.controller.abort();
          return false;
        }
        return true;
      });
    }
    const url = this.url
      .replace("{z}", c.z.toString())
      .replace("{x}", c.x.toString())
      .replace("{y}", c.y.toString());
    const controller = new AbortController();
    this.zoomaborts.push({ z: c.z, controller: controller });
    const signal = controller.signal;
    return new Promise((resolve, reject) => {
      fetch(url, { signal: signal })
        .then((resp) => {
          return resp.arrayBuffer();
        })
        .then((buffer) => {
          const result = parseTile(buffer, tileSize);
          resolve(result);
        })
        .catch((e) => {
          reject(e);
        });
    });
  }
}

export interface CacheEntry {
  used: number;
  data: Map<string, Feature[]>;
}

export interface PickedFeature {
  feature: Feature;
  layerName: string;
}

interface PromiseOptions {
  resolve: (result: Map<string, Feature[]>) => void;
  reject: (e: Error) => void;
}

export class TileCache {
  source: TileSource;
  cache: Map<string, CacheEntry>;
  inflight: Map<string, PromiseOptions[]>;
  tileSize: number;

  constructor(source: TileSource, tileSize: number) {
    this.source = source;
    this.cache = new Map<string, CacheEntry>();
    this.inflight = new Map<string, PromiseOptions[]>();
    this.tileSize = tileSize;
  }

  public async get(c: Zxy): Promise<Map<string, Feature[]>> {
    const idx = toIndex(c);
    return new Promise((resolve, reject) => {
      const entry = this.cache.get(idx);
      if (entry) {
        entry.used = performance.now();
        resolve(entry.data);
      } else {
        const ifentry = this.inflight.get(idx);
        if (ifentry) {
          ifentry.push({ resolve: resolve, reject: reject });
        } else {
          this.inflight.set(idx, []);
          this.source
            .get(c, this.tileSize)
            .then((tile) => {
              this.cache.set(idx, { used: performance.now(), data: tile });

              const ifentry2 = this.inflight.get(idx);
              if (ifentry2) {
                for (const f of ifentry2) {
                  f.resolve(tile);
                }
              }
              this.inflight.delete(idx);
              resolve(tile);

              if (this.cache.size >= 64) {
                let min_used = +Infinity;
                let min_key = undefined;
                this.cache.forEach((value, key) => {
                  if (value.used < min_used) {
                    min_used = value.used;
                    min_key = key;
                  }
                });
                if (min_key) this.cache.delete(min_key);
              }
            })
            .catch((e) => {
              const ifentry2 = this.inflight.get(idx);
              if (ifentry2) {
                for (const f of ifentry2) {
                  f.reject(e);
                }
              }
              this.inflight.delete(idx);
              reject(e);
            });
        }
      }
    });
  }
}

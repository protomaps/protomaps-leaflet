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
    // biome-ignore lint: need to use private fields of vector-tile
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

interface CacheEntry {
  used: number;
  data: Map<string, Feature[]>;
}

interface PromiseOptions {
  resolve: (result: Map<string, Feature[]>) => void;
  reject: (e: Error) => void;
}

export interface PickedFeature {
  feature: Feature;
  layerName: string;
}

const R = 6378137;
const MAX_LATITUDE = 85.0511287798;
const MAXCOORD = R * Math.PI;

const project = (latlng: number[]) => {
  const d = Math.PI / 180;
  const constrainedLat = Math.max(
    Math.min(MAX_LATITUDE, latlng[0]),
    -MAX_LATITUDE,
  );
  const sin = Math.sin(constrainedLat * d);
  return new Point(
    R * latlng[1] * d,
    (R * Math.log((1 + sin) / (1 - sin))) / 2,
  );
};

function sqr(x: number) {
  return x * x;
}

function dist2(v: Point, w: Point) {
  return sqr(v.x - w.x) + sqr(v.y - w.y);
}

function distToSegmentSquared(p: Point, v: Point, w: Point) {
  const l2 = dist2(v, w);
  if (l2 === 0) return dist2(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist2(p, new Point(v.x + t * (w.x - v.x), v.y + t * (w.y - v.y)));
}

export function isInRing(point: Point, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x;
    const yi = ring[i].y;
    const xj = ring[j].x;
    const yj = ring[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isCcw(ring: Point[]): boolean {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    area += ring[i].x * ring[j].y;
    area -= ring[j].x * ring[i].y;
  }
  return area < 0;
}

export function pointInPolygon(point: Point, geom: Point[][]): boolean {
  let isInCurrentExterior = false;
  for (const ring of geom) {
    if (isCcw(ring)) {
      // it is an interior ring
      if (isInRing(point, ring)) isInCurrentExterior = false;
    } else {
      // it is an exterior ring
      if (isInCurrentExterior) return true;
      if (isInRing(point, ring)) isInCurrentExterior = true;
    }
  }
  return isInCurrentExterior;
}

export function pointMinDistToPoints(point: Point, geom: Point[][]): number {
  let min = Infinity;
  for (const l of geom) {
    const dist = Math.sqrt(dist2(point, l[0]));
    if (dist < min) min = dist;
  }
  return min;
}

export function pointMinDistToLines(point: Point, geom: Point[][]): number {
  let min = Infinity;
  for (const l of geom) {
    for (let i = 0; i < l.length - 1; i++) {
      const dist = Math.sqrt(distToSegmentSquared(point, l[i], l[i + 1]));
      if (dist < min) min = dist;
    }
  }
  return min;
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
                let minUsed = +Infinity;
                let minKey = undefined;
                this.cache.forEach((value, key) => {
                  if (value.used < minUsed) {
                    minUsed = value.used;
                    minKey = key;
                  }
                });
                if (minKey) this.cache.delete(minKey);
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

  public queryFeatures(
    lng: number,
    lat: number,
    zoom: number,
    brushSize: number,
  ): PickedFeature[] {
    const projected = project([lat, lng]);
    const normalized = new Point(
      (projected.x + MAXCOORD) / (MAXCOORD * 2),
      1 - (projected.y + MAXCOORD) / (MAXCOORD * 2),
    );
    if (normalized.x > 1)
      normalized.x = normalized.x - Math.floor(normalized.x);
    const onZoom = normalized.mult(1 << zoom);
    const tileX = Math.floor(onZoom.x);
    const tileY = Math.floor(onZoom.y);
    const idx = toIndex({ z: zoom, x: tileX, y: tileY });
    const retval: PickedFeature[] = [];
    const entry = this.cache.get(idx);
    if (entry) {
      const center = new Point(
        (onZoom.x - tileX) * this.tileSize,
        (onZoom.y - tileY) * this.tileSize,
      );
      for (const [layerName, layerArr] of entry.data.entries()) {
        for (const feature of layerArr) {
          if (feature.geomType === GeomType.Point) {
            if (pointMinDistToPoints(center, feature.geom) < brushSize) {
              retval.push({ feature, layerName: layerName });
            }
          } else if (feature.geomType === GeomType.Line) {
            if (pointMinDistToLines(center, feature.geom) < brushSize) {
              retval.push({ feature, layerName: layerName });
            }
          } else {
            if (pointInPolygon(center, feature.geom)) {
              retval.push({ feature, layerName: layerName });
            }
          }
        }
      }
    }
    return retval;
  }
}

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
  return c.x + ":" + c.y + ":" + c.z;
}

export interface TileSource {
  get(c: Zxy, tileSize: number): Promise<Map<string, Feature[]>>;
}

// reimplement loadGeometry with a scalefactor
// so the general tile rendering case does not need rescaling.
const loadGeomAndBbox = (pbf: any, geometry: number, scale: number) => {
  pbf.pos = geometry;
  var end = pbf.readVarint() + pbf.pos,
    cmd = 1,
    length = 0,
    x = 0,
    y = 0,
    x1 = Infinity,
    x2 = -Infinity,
    y1 = Infinity,
    y2 = -Infinity;

  var lines: Point[][] = [];
  var line: Point[] = [];
  while (pbf.pos < end) {
    if (length <= 0) {
      var cmdLen = pbf.readVarint();
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
    } else throw new Error("unknown command " + cmd);
  }
  if (line) lines.push(line);
  return { geom: lines, bbox: { minX: x1, minY: y1, maxX: x2, maxY: y2 } };
};

function parseTile(
  buffer: ArrayBuffer,
  tileSize: number
): Map<string, Feature[]> {
  let v = new VectorTile(new Protobuf(buffer));
  let result = new Map<string, Feature[]>();
  for (let [key, value] of Object.entries(v.layers)) {
    let features = [];
    let layer = value as any;
    for (let i = 0; i < layer.length; i++) {
      let loaded = loadGeomAndBbox(
        layer.feature(i)._pbf,
        layer.feature(i)._geometry,
        tileSize / layer.extent
      );
      let numVertices = 0;
      for (let part of loaded.geom) numVertices += part.length;
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
  controllers: any[];
  shouldCancelZooms: boolean;

  constructor(url: any, shouldCancelZooms: boolean) {
    if (url.url) {
      this.p = url;
    } else {
      this.p = new PMTiles(url);
    }
    this.controllers = [];
    this.shouldCancelZooms = shouldCancelZooms;
  }

  public async get(c: Zxy, tileSize: number): Promise<Map<string, Feature[]>> {
    if (this.shouldCancelZooms) {
      this.controllers = this.controllers.filter((cont) => {
        if (cont[0] != c.z) {
          cont[1].abort();
          return false;
        }
        return true;
      });
    }
    let result = await this.p.getZxy(c.z, c.x, c.y);

    const controller = new AbortController();
    this.controllers.push([c.z, controller]);
    const signal = controller.signal;
    return new Promise((resolve, reject) => {
      if (result) {
        fetch(this.p.url, {
          headers: {
            Range:
              "bytes=" +
              result.offset +
              "-" +
              (result.offset + result.length - 1),
          },
          signal: signal,
        })
          .then((resp) => {
            return resp.arrayBuffer();
          })
          .then((buffer) => {
            let result = parseTile(buffer, tileSize);
            resolve(result);
          })
          .catch((e) => {
            reject(e);
          });
      } else {
        reject(new Error(`Tile ${c.z} ${c.x} ${c.y} not found in archive`));
      }
    });
  }
}

export class ZxySource implements TileSource {
  url: string;
  controllers: any[];
  shouldCancelZooms: boolean;

  constructor(url: string, shouldCancelZooms: boolean) {
    this.url = url;
    this.controllers = [];
    this.shouldCancelZooms = shouldCancelZooms;
  }

  public async get(c: Zxy, tileSize: number): Promise<Map<string, Feature[]>> {
    if (this.shouldCancelZooms) {
      this.controllers = this.controllers.filter((cont) => {
        if (cont[0] != c.z) {
          cont[1].abort();
          return false;
        }
        return true;
      });
    }
    let url = this.url
      .replace("{z}", c.z.toString())
      .replace("{x}", c.x.toString())
      .replace("{y}", c.y.toString());
    const controller = new AbortController();
    this.controllers.push([c.z, controller]);
    const signal = controller.signal;
    return new Promise((resolve, reject) => {
      fetch(url, { signal: signal })
        .then((resp) => {
          return resp.arrayBuffer();
        })
        .then((buffer) => {
          let result = parseTile(buffer, tileSize);
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

let R = 6378137;
let MAX_LATITUDE = 85.0511287798;
let MAXCOORD = R * Math.PI;

let project = (latlng: number[]) => {
  let d = Math.PI / 180;
  let constrained_lat = Math.max(
    Math.min(MAX_LATITUDE, latlng[0]),
    -MAX_LATITUDE
  );
  let sin = Math.sin(constrained_lat * d);
  return new Point(
    R * latlng[1] * d,
    (R * Math.log((1 + sin) / (1 - sin))) / 2
  );
};

function sqr(x: number) {
  return x * x;
}

function dist2(v: Point, w: Point) {
  return sqr(v.x - w.x) + sqr(v.y - w.y);
}

function distToSegmentSquared(p: Point, v: Point, w: Point) {
  var l2 = dist2(v, w);
  if (l2 === 0) return dist2(p, v);
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist2(p, new Point(v.x + t * (w.x - v.x), v.y + t * (w.y - v.y)));
}

export function isInRing(point: Point, ring: Point[]): boolean {
  var inside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    var xi = ring[i].x,
      yi = ring[i].y;
    var xj = ring[j].x,
      yj = ring[j].y;
    var intersect =
      yi > point.y != yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isCCW(ring: Point[]): boolean {
  var area = 0;
  for (var i = 0; i < ring.length; i++) {
    let j = (i + 1) % ring.length;
    area += ring[i].x * ring[j].y;
    area -= ring[j].x * ring[i].y;
  }
  return area < 0;
}

export function pointInPolygon(point: Point, geom: Point[][]): boolean {
  var isInCurrentExterior = false;
  for (let ring of geom) {
    if (isCCW(ring)) {
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
  for (let l of geom) {
    let dist = Math.sqrt(dist2(point, l[0]));
    if (dist < min) min = dist;
  }
  return min;
}

export function pointMinDistToLines(point: Point, geom: Point[][]): number {
  let min = Infinity;
  for (let l of geom) {
    for (var i = 0; i < l.length - 1; i++) {
      let dist = Math.sqrt(distToSegmentSquared(point, l[i], l[i + 1]));
      if (dist < min) min = dist;
    }
  }
  return min;
}

export interface PickedFeature {
  feature: Feature;
  layerName: string;
}

export class TileCache {
  source: TileSource;
  cache: Map<string, CacheEntry>;
  inflight: Map<string, any[]>;
  tileSize: number;

  constructor(source: TileSource, tileSize: number) {
    this.source = source;
    this.cache = new Map<string, CacheEntry>();
    this.inflight = new Map<string, any[]>();
    this.tileSize = tileSize;
  }

  public queryFeatures(
    lng: number,
    lat: number,
    zoom: number,
    brushSize: number
  ): PickedFeature[] {
    let projected = project([lat, lng]);
    var normalized = new Point(
      (projected.x + MAXCOORD) / (MAXCOORD * 2),
      1 - (projected.y + MAXCOORD) / (MAXCOORD * 2)
    );
    if (normalized.x > 1)
      normalized.x = normalized.x - Math.floor(normalized.x);
    let on_zoom = normalized.mult(1 << zoom);
    let tile_x = Math.floor(on_zoom.x);
    let tile_y = Math.floor(on_zoom.y);
    const idx = toIndex({ z: zoom, x: tile_x, y: tile_y });
    let retval: PickedFeature[] = [];
    let entry = this.cache.get(idx);
    if (entry) {
      const center = new Point(
        (on_zoom.x - tile_x) * this.tileSize,
        (on_zoom.y - tile_y) * this.tileSize
      );
      for (let [layer_name, layer_arr] of entry.data.entries()) {
        for (let feature of layer_arr) {
          // rough check by bbox
          //  if ((query_bbox.maxX >= feature.bbox.minX && feature.bbox.maxX >= query_bbox.minX) &&
          //      (query_bbox.maxY >= feature.bbox.minY && feature.bbox.maxY >= query_bbox.minY)) {
          //  }

          if (feature.geomType == GeomType.Point) {
            if (pointMinDistToPoints(center, feature.geom) < brushSize) {
              retval.push({ feature, layerName: layer_name });
            }
          } else if (feature.geomType == GeomType.Line) {
            if (pointMinDistToLines(center, feature.geom) < brushSize) {
              retval.push({ feature, layerName: layer_name });
            }
          } else {
            if (pointInPolygon(center, feature.geom)) {
              retval.push({ feature, layerName: layer_name });
            }
          }
        }
      }
    }
    return retval;
  }

  public async get(c: Zxy): Promise<Map<string, Feature[]>> {
    const idx = toIndex(c);
    return new Promise((resolve, reject) => {
      let entry = this.cache.get(idx);
      if (entry) {
        entry.used = performance.now();
        resolve(entry.data);
      } else {
        let ifentry = this.inflight.get(idx);
        if (ifentry) {
          ifentry.push([resolve, reject]);
        } else {
          this.inflight.set(idx, []);
          this.source
            .get(c, this.tileSize)
            .then((tile) => {
              this.cache.set(idx, { used: performance.now(), data: tile });

              let ifentry2 = this.inflight.get(idx);
              if (ifentry2) ifentry2.forEach((f) => f[0](tile));
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
              let ifentry2 = this.inflight.get(idx);
              if (ifentry2) ifentry2.forEach((f) => f[1](e));
              this.inflight.delete(idx);
              reject(e);
            });
        }
      }
    });
  }
}

import Point from "@mapbox/point-geometry";
import rBush from "rbush";
import { Filter } from "./painter";
import { DrawExtra, LabelSymbolizer } from "./symbolizer";
import { Bbox, JsonObject, toIndex } from "./tilecache";
import { PreparedTile, transformGeom } from "./view";

type TileInvalidationCallback = (tiles: Set<string>) => void;

// the anchor should be contained within, or on the boundary of,
// one of the bounding boxes. This is not enforced by library,
// but is required for label deduplication.
export interface Label {
  anchor: Point;
  bboxes: Bbox[];
  draw: (ctx: CanvasRenderingContext2D, drawExtra?: DrawExtra) => void;
  deduplicationKey?: string;
  deduplicationDistance?: number;
}

export interface IndexedLabel {
  anchor: Point;
  bboxes: Bbox[];
  draw: (ctx: CanvasRenderingContext2D) => void;
  order: number;
  tileKey: string;
  deduplicationKey?: string;
  deduplicationDistance?: number;
}

type TreeItem = Bbox & { indexedLabel: IndexedLabel };

export interface Layout {
  index: Index;
  order: number;
  scratch: CanvasRenderingContext2D;
  zoom: number;
  overzoom: number;
}

export interface LabelRule {
  id?: string;
  minzoom?: number;
  maxzoom?: number;
  dataSource?: string;
  dataLayer: string;
  symbolizer: LabelSymbolizer;
  filter?: Filter;
  visible?: boolean;
  sort?: (a: JsonObject, b: JsonObject) => number;
}

export const covering = (
  displayZoom: number,
  tileWidth: number,
  bbox: Bbox,
) => {
  const res = 256;
  const f = tileWidth / res;

  const minx = Math.floor(bbox.minX / res);
  const miny = Math.floor(bbox.minY / res);
  const maxx = Math.floor(bbox.maxX / res);
  const maxy = Math.floor(bbox.maxY / res);
  const leveldiff = Math.log2(f);

  const retval = [];
  for (let x = minx; x <= maxx; x++) {
    const wrappedX = x % (1 << displayZoom);
    for (let y = miny; y <= maxy; y++) {
      retval.push({
        display: toIndex({ z: displayZoom, x: wrappedX, y: y }),
        key: toIndex({
          z: displayZoom - leveldiff,
          x: Math.floor(wrappedX / f),
          y: Math.floor(y / f),
        }),
      });
    }
  }
  return retval;
};

export class Index {
  tree: rBush<TreeItem>;
  current: Map<string, Set<IndexedLabel>>;
  dim: number;
  maxLabeledTiles: number;

  constructor(dim: number, maxLabeledTiles: number) {
    this.tree = new rBush();
    this.current = new Map();
    this.dim = dim;
    this.maxLabeledTiles = maxLabeledTiles;
  }

  public hasPrefix(tileKey: string): boolean {
    for (const key of this.current.keys()) {
      if (key.startsWith(tileKey)) return true;
    }
    return false;
  }

  public has(tileKey: string): boolean {
    return this.current.has(tileKey);
  }

  public size(): number {
    return this.current.size;
  }

  public keys() {
    return this.current.keys();
  }

  public searchBbox(bbox: Bbox, order: number): Set<IndexedLabel> {
    const labels = new Set<IndexedLabel>();
    for (const match of this.tree.search(bbox)) {
      if (match.indexedLabel.order <= order) {
        labels.add(match.indexedLabel);
      }
    }
    return labels;
  }

  public searchLabel(label: Label, order: number): Set<IndexedLabel> {
    const labels = new Set<IndexedLabel>();
    for (const bbox of label.bboxes) {
      for (const match of this.tree.search(bbox)) {
        if (match.indexedLabel.order <= order) {
          labels.add(match.indexedLabel);
        }
      }
    }
    return labels;
  }

  public bboxCollides(bbox: Bbox, order: number): boolean {
    for (const match of this.tree.search(bbox)) {
      if (match.indexedLabel.order <= order) return true;
    }
    return false;
  }

  public labelCollides(label: Label, order: number): boolean {
    for (const bbox of label.bboxes) {
      for (const match of this.tree.search(bbox)) {
        if (match.indexedLabel.order <= order) return true;
      }
    }
    return false;
  }

  public deduplicationCollides(label: Label): boolean {
    // create a bbox around anchor to find potential matches.
    // this is depending on precondition: (anchor is contained within, or on boundary of, a label bbox)
    if (!label.deduplicationKey || !label.deduplicationDistance) return false;
    const dist = label.deduplicationDistance;
    const testBbox = {
      minX: label.anchor.x - dist,
      minY: label.anchor.y - dist,
      maxX: label.anchor.x + dist,
      maxY: label.anchor.y + dist,
    };
    for (const collision of this.tree.search(testBbox)) {
      if (collision.indexedLabel.deduplicationKey === label.deduplicationKey) {
        if (collision.indexedLabel.anchor.dist(label.anchor) < dist) {
          return true;
        }
      }
    }
    return false;
  }

  public makeEntry(tileKey: string) {
    if (this.current.get(tileKey)) {
      console.log("consistency error 1");
    }
    const newSet = new Set<IndexedLabel>();
    this.current.set(tileKey, newSet);
  }

  // can put in multiple due to antimeridian wrapping
  public insert(label: Label, order: number, tileKey: string): void {
    const indexedLabel = {
      anchor: label.anchor,
      bboxes: label.bboxes,
      draw: label.draw,
      order: order,
      tileKey: tileKey,
      deduplicationKey: label.deduplicationKey,
      deduplicationDistance: label.deduplicationDistance,
    };
    let entry = this.current.get(tileKey);
    if (!entry) {
      const newSet = new Set<IndexedLabel>();
      this.current.set(tileKey, newSet);
      entry = newSet;
    }
    entry.add(indexedLabel);

    let wrapsLeft = false;
    let wrapsRight = false;
    for (const bbox of label.bboxes) {
      this.tree.insert({
        minX: bbox.minX,
        minY: bbox.minY,
        maxX: bbox.maxX,
        maxY: bbox.maxY,
        indexedLabel: indexedLabel,
      });
      if (bbox.minX < 0) wrapsLeft = true;
      if (bbox.maxX > this.dim) wrapsRight = true;
    }

    if (wrapsLeft || wrapsRight) {
      const shift = wrapsLeft ? this.dim : -this.dim;

      const newBboxes = [];
      for (const bbox of label.bboxes) {
        newBboxes.push({
          minX: bbox.minX + shift,
          minY: bbox.minY,
          maxX: bbox.maxX + shift,
          maxY: bbox.maxY,
        });
      }
      const duplicateLabel = {
        anchor: new Point(label.anchor.x + shift, label.anchor.y),
        bboxes: newBboxes,
        draw: label.draw,
        order: order,
        tileKey: tileKey,
      };
      const entry = this.current.get(tileKey);
      if (entry) entry.add(duplicateLabel);
      for (const bbox of newBboxes) {
        this.tree.insert({
          minX: bbox.minX,
          minY: bbox.minY,
          maxX: bbox.maxX,
          maxY: bbox.maxY,
          indexedLabel: duplicateLabel,
        });
      }
    }
  }

  public pruneOrNoop(keyAdded: string) {
    const added = keyAdded.split(":");
    let maxKey = undefined;
    let maxDist = 0;
    let keysForDs = 0;

    for (const existingKey of this.current.keys()) {
      const existing = existingKey.split(":");
      if (existing[3] === added[3]) {
        keysForDs++;
        const dist = Math.sqrt(
          (+existing[0] - +added[0]) ** 2 + (+existing[1] - +added[1]) ** 2,
        );
        if (dist > maxDist) {
          maxDist = dist;
          maxKey = existingKey;
        }
      }

      if (maxKey && keysForDs > this.maxLabeledTiles) {
        this.pruneKey(maxKey);
      }
    }
  }

  public pruneKey(keyToRemove: string): void {
    const indexedLabels = this.current.get(keyToRemove);
    if (!indexedLabels) return; // TODO: not that clean...
    const entriesToDelete = [];
    for (const entry of this.tree.all()) {
      if (indexedLabels.has(entry.indexedLabel)) {
        entriesToDelete.push(entry);
      }
    }
    for (const entry of entriesToDelete) {
      this.tree.remove(entry);
    }
    this.current.delete(keyToRemove);
  }

  // NOTE: technically this is incorrect
  // with antimeridian wrapping, since we should also remove
  // the duplicate label; but i am having a hard time
  // imagining where this will happen in practical usage
  public removeLabel(labelToRemove: IndexedLabel): void {
    const entriesToDelete = [];
    for (const entry of this.tree.all()) {
      if (labelToRemove === entry.indexedLabel) {
        entriesToDelete.push(entry);
      }
    }
    for (const entry of entriesToDelete) {
      this.tree.remove(entry);
    }
    const c = this.current.get(labelToRemove.tileKey);
    if (c) c.delete(labelToRemove);
  }
}

export class Labeler {
  index: Index;
  z: number;
  scratch: CanvasRenderingContext2D;
  labelRules: LabelRule[];
  callback?: TileInvalidationCallback;

  constructor(
    z: number,
    scratch: CanvasRenderingContext2D,
    labelRules: LabelRule[],
    maxLabeledTiles: number,
    callback?: TileInvalidationCallback,
  ) {
    this.index = new Index((256 * 1) << z, maxLabeledTiles);
    this.z = z;
    this.scratch = scratch;
    this.labelRules = labelRules;
    this.callback = callback;
  }

  private layout(preparedTilemap: Map<string, PreparedTile[]>): number {
    const start = performance.now();

    const keysAdding = new Set<string>();
    // if it already exists... short circuit
    for (const [k, preparedTiles] of preparedTilemap) {
      for (const preparedTile of preparedTiles) {
        const key = `${toIndex(preparedTile.dataTile)}:${k}`;
        if (!this.index.has(key)) {
          this.index.makeEntry(key);
          keysAdding.add(key);
        }
      }
    }

    const tilesInvalidated = new Set<string>();
    for (const [order, rule] of this.labelRules.entries()) {
      if (rule.visible === false) continue;
      if (rule.minzoom && this.z < rule.minzoom) continue;
      if (rule.maxzoom && this.z > rule.maxzoom) continue;

      const dsName = rule.dataSource || "";
      const preparedTiles = preparedTilemap.get(dsName);
      if (!preparedTiles) continue;

      for (const preparedTile of preparedTiles) {
        const key = `${toIndex(preparedTile.dataTile)}:${dsName}`;
        if (!keysAdding.has(key)) continue;

        const layer = preparedTile.data.get(rule.dataLayer);
        if (layer === undefined) continue;

        const feats = layer;
        if (rule.sort)
          feats.sort((a, b) => {
            if (rule.sort) {
              return rule.sort(a.props, b.props);
            }
            return 0;
          });

        const layout = {
          index: this.index,
          zoom: this.z,
          scratch: this.scratch,
          order: order,
          overzoom: this.z - preparedTile.dataTile.z,
        };
        for (const feature of feats) {
          if (rule.filter && !rule.filter(this.z, feature)) continue;
          const transformed = transformGeom(
            feature.geom,
            preparedTile.scale,
            preparedTile.origin,
          );
          const labels = rule.symbolizer.place(layout, transformed, feature);
          if (!labels) continue;

          for (const label of labels) {
            let labelAdded = false;
            if (
              label.deduplicationKey &&
              this.index.deduplicationCollides(label)
            ) {
              continue;
            }

            // does the label collide with anything?
            if (this.index.labelCollides(label, Infinity)) {
              if (!this.index.labelCollides(label, order)) {
                const conflicts = this.index.searchLabel(label, Infinity);
                for (const conflict of conflicts) {
                  this.index.removeLabel(conflict);
                  for (const bbox of conflict.bboxes) {
                    this.findInvalidatedTiles(
                      tilesInvalidated,
                      preparedTile.dim,
                      bbox,
                      key,
                    );
                  }
                }
                this.index.insert(label, order, key);
                labelAdded = true;
              }
              // label not added.
            } else {
              this.index.insert(label, order, key);
              labelAdded = true;
            }

            if (labelAdded) {
              for (const bbox of label.bboxes) {
                if (
                  bbox.maxX > preparedTile.origin.x + preparedTile.dim ||
                  bbox.minX < preparedTile.origin.x ||
                  bbox.minY < preparedTile.origin.y ||
                  bbox.maxY > preparedTile.origin.y + preparedTile.dim
                ) {
                  this.findInvalidatedTiles(
                    tilesInvalidated,
                    preparedTile.dim,
                    bbox,
                    key,
                  );
                }
              }
            }
          }
        }
      }
    }

    for (const key of keysAdding) {
      this.index.pruneOrNoop(key);
    }

    if (tilesInvalidated.size > 0 && this.callback) {
      this.callback(tilesInvalidated);
    }
    return performance.now() - start;
  }

  private findInvalidatedTiles(
    tilesInvalidated: Set<string>,
    dim: number,
    bbox: Bbox,
    key: string,
  ) {
    const touched = covering(this.z, dim, bbox);
    for (const s of touched) {
      if (s.key !== key && this.index.hasPrefix(s.key)) {
        tilesInvalidated.add(s.display);
      }
    }
  }

  public add(preparedTilemap: Map<string, PreparedTile[]>): number {
    let allAdded = true;
    for (const [k, preparedTiles] of preparedTilemap) {
      for (const preparedTile of preparedTiles) {
        if (!this.index.has(`${toIndex(preparedTile.dataTile)}:${k}`))
          allAdded = false;
      }
    }

    if (allAdded) {
      return 0;
    }
    const timing = this.layout(preparedTilemap);
    return timing;
  }
}

export class Labelers {
  labelers: Map<number, Labeler>;
  scratch: CanvasRenderingContext2D;
  labelRules: LabelRule[];
  maxLabeledTiles: number;
  callback: TileInvalidationCallback;

  constructor(
    scratch: CanvasRenderingContext2D,
    labelRules: LabelRule[],
    maxLabeledTiles: number,
    callback: TileInvalidationCallback,
  ) {
    this.labelers = new Map<number, Labeler>();
    this.scratch = scratch;
    this.labelRules = labelRules;
    this.maxLabeledTiles = maxLabeledTiles;
    this.callback = callback;
  }

  public add(z: number, preparedTilemap: Map<string, PreparedTile[]>): number {
    let labeler = this.labelers.get(z);
    if (labeler) {
      return labeler.add(preparedTilemap);
    }
    labeler = new Labeler(
      z,
      this.scratch,
      this.labelRules,
      this.maxLabeledTiles,
      this.callback,
    );
    this.labelers.set(z, labeler);
    return labeler.add(preparedTilemap);
  }

  public getIndex(z: number) {
    const labeler = this.labelers.get(z);
    if (labeler) return labeler.index; // TODO cleanup
  }
}

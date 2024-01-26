import Point from "@mapbox/point-geometry";
import { Index } from "./labeler";
import { PaintSymbolizer } from "./symbolizer";
import { Bbox, Feature } from "./tilecache";
import { PreparedTile, transformGeom } from "./view";

export type Filter = (zoom: number, feature: Feature) => boolean;

export interface PaintRule {
  id?: string;
  minzoom?: number;
  maxzoom?: number;
  dataSource?: string;
  dataLayer: string;
  symbolizer: PaintSymbolizer;
  filter?: Filter;
}

export function paint(
  ctx: CanvasRenderingContext2D,
  z: number,
  preparedTilemap: Map<string, PreparedTile[]>,
  labelData: Index | null,
  rules: PaintRule[],
  bbox: Bbox,
  origin: Point,
  clip: boolean,
  debug?: string,
) {
  const start = performance.now();
  ctx.save();
  ctx.miterLimit = 2;

  for (const rule of rules) {
    if (rule.minzoom && z < rule.minzoom) continue;
    if (rule.maxzoom && z > rule.maxzoom) continue;
    const preparedTiles = preparedTilemap.get(rule.dataSource || "");
    if (!preparedTiles) continue;
    for (const preparedTile of preparedTiles) {
      const layer = preparedTile.data.get(rule.dataLayer);
      if (layer === undefined) continue;
      if (rule.symbolizer.before) rule.symbolizer.before(ctx, preparedTile.z);

      const po = preparedTile.origin;
      const dim = preparedTile.dim;
      const ps = preparedTile.scale;
      ctx.save();

      // apply clipping to the tile
      // find the smallest of all the origins
      if (clip) {
        ctx.beginPath();
        const minX = Math.max(po.x - origin.x, bbox.minX - origin.x); // - 0.5;
        const minY = Math.max(po.y - origin.y, bbox.minY - origin.y); // - 0.5;
        const maxX = Math.min(po.x - origin.x + dim, bbox.maxX - origin.x); // + 0.5;
        const maxY = Math.min(po.y - origin.y + dim, bbox.maxY - origin.y); // + 0.5;
        ctx.rect(minX, minY, maxX - minX, maxY - minY);
        ctx.clip();
      }

      ctx.translate(po.x - origin.x, po.y - origin.y);

      // TODO fix seams in static mode
      // if (clip) {
      //     // small fudge factor in static mode to fix seams
      //     ctx.translate(dim / 2, dim / 2);
      //     ctx.scale(1 + 1 / dim, 1 + 1 / dim);
      //     ctx.translate(-dim / 2, -dim / 2);
      // }

      for (const feature of layer) {
        let geom = feature.geom;
        const fbox = feature.bbox;
        if (
          fbox.maxX * ps + po.x < bbox.minX ||
          fbox.minX * ps + po.x > bbox.maxX ||
          fbox.minY * ps + po.y > bbox.maxY ||
          fbox.maxY * ps + po.y < bbox.minY
        ) {
          continue;
        }
        if (rule.filter && !rule.filter(preparedTile.z, feature)) continue;
        if (ps !== 1) {
          geom = transformGeom(geom, ps, new Point(0, 0));
        }
        rule.symbolizer.draw(ctx, geom, preparedTile.z, feature);
      }
      ctx.restore();
    }
  }

  if (clip) {
    ctx.beginPath();
    ctx.rect(
      bbox.minX - origin.x,
      bbox.minY - origin.y,
      bbox.maxX - bbox.minX,
      bbox.maxY - bbox.minY,
    );
    ctx.clip();
  }

  if (labelData) {
    const matches = labelData.searchBbox(bbox, Infinity);
    for (const label of matches) {
      ctx.save();
      ctx.translate(label.anchor.x - origin.x, label.anchor.y - origin.y);
      label.draw(ctx);
      ctx.restore();
      if (debug) {
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = debug;
        ctx.fillStyle = debug;
        ctx.globalAlpha = 1;
        ctx.fillRect(
          label.anchor.x - origin.x - 2,
          label.anchor.y - origin.y - 2,
          4,
          4,
        );
        for (const bbox of label.bboxes) {
          ctx.strokeRect(
            bbox.minX - origin.x,
            bbox.minY - origin.y,
            bbox.maxX - bbox.minX,
            bbox.maxY - bbox.minY,
          );
        }
      }
    }
  }
  ctx.restore();
  return performance.now() - start;
}

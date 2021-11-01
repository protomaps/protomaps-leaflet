// @ts-ignore
import Point from "@mapbox/point-geometry";
import simplify from "simplify-js";
import PolygonClipping, { Polygon } from "polygon-clipping";
import { Bbox } from "./tilecache";

export const splitMultiLineString = (mls: Point[][], maxVertices: number) => {
  let retval = [];
  var current = [];
  let currentVertices = 0;
  for (let ls of mls) {
    if (ls.length > maxVertices) {
      console.log("LineString with length: ", ls.length);
    }
    if (current.length > 0 && currentVertices + ls.length > maxVertices) {
      retval.push(current);
      current = [];
      currentVertices = 0;
    }
    current.push(ls);
    currentVertices += ls.length;
  }
  if (current.length > 0) retval.push(current);
  return retval;
};

const verticesCount = (rings: Point[][]): number => {
  var acc = 0;
  for (let ring of rings) {
    acc += ring.length;
  }
  return acc;
};

export const splitMultiPolygon = (mp: Point[][], bbox: Bbox) => {
  const flat = mp.map((m) => m.map((p) => [p.x, p.y]));
  const centerPoint = {
    x: (bbox.minX + bbox.maxX) / 2,
    y: (bbox.minY + bbox.maxY) / 2,
  };
  const nw = [
    [
      [bbox.minX, bbox.minY],
      [bbox.minX, centerPoint.y],
      [centerPoint.x, centerPoint.y],
      [centerPoint.x, bbox.minY],
    ],
  ];
  const ne = [
    [
      [centerPoint.x, bbox.minY],
      [centerPoint.x, centerPoint.y],
      [bbox.maxX, centerPoint.y],
      [bbox.maxX, bbox.minY],
    ],
  ];
  const sw = [
    [
      [bbox.minX, centerPoint.y],
      [bbox.minX, bbox.maxY],
      [centerPoint.x, bbox.maxY],
      [centerPoint.x, centerPoint.y],
    ],
  ];
  const se = [
    [
      [centerPoint.x, centerPoint.y],
      [centerPoint.x, bbox.maxY],
      [bbox.maxX, bbox.maxY],
      [bbox.maxX, centerPoint.y],
    ],
  ];
  const firstQuadrant = PolygonClipping.intersection(flat, nw as Polygon);
  const secondQuadrant = PolygonClipping.intersection(flat, ne as Polygon);
  const thirdQuadrant = PolygonClipping.intersection(flat, se as Polygon);
  const fourthQuadrant = PolygonClipping.intersection(flat, sw as Polygon);
  return [firstQuadrant, secondQuadrant, thirdQuadrant, fourthQuadrant];
};

export const simplifyToMax = (seq: Point[], limit: number): Point[] => {
  var result = simplify(seq, 1);
  // console.log("Step 1", seq.length, result.length);
  if (result.length < limit) return result;
  result = simplify(seq, 2);
  // console.log("Step 2", seq.length, result.length);
  if (result.length < limit) return result;
  result = simplify(seq, 3);
  // console.log("Step 3", seq.length, result.length);
  return result;
};

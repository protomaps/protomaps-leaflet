// @ts-ignore
import Point from "@mapbox/point-geometry";
import simplify from "simplify-js";
import { isCCW } from "./tilecache";

export const splitMultiLineString = (mls: Point[][], maxVertices:number) => {
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

const verticesCount = (rings:Point[][]) : number => {
    var acc = 0;
    for (let ring of rings) {
        acc += ring.length;
    }
    return acc;
}

export const splitMultiPolygon = (mp: Point[][], maxVertices:number) => {
  console.log("Total:", mp);
  // group the MultiPolygon into individual polygons based on winding order
  let complete_polygons = [];
  let current_polygon = [];
  for (let poly of mp) {
    if (current_polygon.length > 0 && !isCCW(poly)) {
        complete_polygons.push(current_polygon);
        current_polygon = [];
    }
    current_polygon.push(poly);
  }

  if (current_polygon.length > 0) complete_polygons.push(current_polygon);

  console.log("Grouped:", complete_polygons);

  // do simplification

  let retval = [];
  var current:Point[][] = [];
  var currentVertices = 0;
  // console.log("Complete polygons: ", complete_polygons.length);
  for (let complete_polygon of complete_polygons) {
    let vc = verticesCount(complete_polygon);
    if (vc > maxVertices) {
        console.log("Total Vertices", vc, "Outer Vertices", complete_polygon[0].length, "Holes", complete_polygon.length-1);
        let outerRingLimit = maxVertices - (vc - (complete_polygon[0].length));
        // console.log("Simplifying outer ring from ", complete_polygon[0].length," to" , outerRingLimit);
        complete_polygon[0] = simplifyToMax(complete_polygon[0],outerRingLimit);
    }
    if (current.length > 0 && currentVertices + vc > maxVertices) {
        retval.push(current);
        current = [];
        currentVertices = 0;
    }
    current = current.concat(complete_polygon);
    currentVertices += vc;
  }
  if (current.length > 0) retval.push(current);

  return retval;
};

export const simplifyToMax = (seq:Point[],limit:number):Point[] => {
   var result = simplify(seq, 1);
   // console.log("Step 1", seq.length, result.length);
   if (result.length < limit) return result;
   result = simplify(seq, 2);
   // console.log("Step 2", seq.length, result.length);
   if (result.length < limit) return result;
   result = simplify(seq, 3);
   // console.log("Step 3", seq.length, result.length);
   return result;
}

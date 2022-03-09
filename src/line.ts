import Point from "@mapbox/point-geometry";

export interface LabelableSegment {
  length: number;
  beginIndex: number;
  beginDistance: number;
  endIndex: number;
  endDistance: number;
}

// code from https://github.com/naturalatlas/linelabel (Apache2)
const linelabel = (
  pts: Point[],
  max_angle_delta: number,
  targetLen: number
): LabelableSegment[] => {
  var chunks = [];
  var a,
    b,
    c,
    i = 0,
    n = 0,
    d = 0;
  var abmag = 0,
    bcmag = 0;
  var abx = 0,
    aby = 0;
  var bcx = 0,
    bcy = 0;
  var dt = 0;
  var i_start = 0;
  var d_start = 0;

  if (pts.length < 2) return [];
  if (pts.length === 2) {
    d = Math.sqrt(
      Math.pow(pts[1].x - pts[0].x, 2) + Math.pow(pts[1].y - pts[0].y, 2)
    );

    return [
      {
        length: d,
        beginIndex: 0,
        beginDistance: 0,
        endIndex: 2,
        endDistance: d,
      },
    ];
  }

  abmag = Math.sqrt(
    Math.pow(pts[1].x - pts[0].x, 2) + Math.pow(pts[1].y - pts[0].y, 2)
  );
  for (i = 1, n = pts.length - 1; i < n; i++) {
    a = pts[i - 1];
    b = pts[i];
    c = pts[i + 1];
    abx = b.x - a.x;
    aby = b.y - a.y;
    bcx = c.x - b.x;
    bcy = c.y - b.y;
    bcmag = Math.sqrt(bcx * bcx + bcy * bcy);
    d += abmag;

    dt = Math.acos((abx * bcx + aby * bcy) / (abmag * bcmag));
    if (dt > max_angle_delta || d - d_start > targetLen) {
      chunks.push({
        length: d - d_start,
        beginDistance: d_start,
        beginIndex: i_start,
        endIndex: i + 1,
        endDistance: d,
      });
      i_start = i;
      d_start = d;
    }
    abmag = bcmag;
  }

  if (i - i_start > 0) {
    chunks.push({
      length: d - d_start + bcmag,
      beginIndex: i_start,
      beginDistance: d_start,
      endIndex: i + 1,
      endDistance: d + bcmag,
    });
  }
  return chunks;
};

export interface LabelCandidate {
  start: Point;
  end: Point;
}

export function simpleLabel(
  mls: any,
  minimum: number,
  repeatDistance: number,
  cellSize: number
): LabelCandidate[] {
  let longestStart;
  let longestEnd;
  let longestLength = 0;

  let candidates = [];

  var lastLabeledDistance = -Infinity;

  for (let ls of mls) {
    let segments = linelabel(ls, Math.PI / 45, minimum); // 4 degrees, close to a straight line
    for (let segment of segments) {
      if (segment.length >= minimum + cellSize) {
        let start = new Point(
          ls[segment.beginIndex].x,
          ls[segment.beginIndex].y
        );
        let end = ls[segment.endIndex - 1];
        let normalized = new Point(
          (end.x - start.x) / segment.length,
          (end.y - start.y) / segment.length
        );

        // offset from the start by cellSize to allow streets that meet at right angles
        // to both be labeled.
        for (
          var i = cellSize;
          i < segment.length - minimum;
          i += repeatDistance
        ) {
          candidates.push({
            start: start.add(normalized.mult(i)),
            end: start.add(normalized.mult(i + minimum)),
          });
        }
      }
    }
  }

  return candidates;
}

export function lineCells(a: Point, b: Point, length: number, spacing: number) {
  // determine function of line
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let dist = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));

  let retval = [];
  // starting from the anchor, generate square cells,
  // guaranteeing to cover the endpoint
  for (var i = 0; i < length + spacing; i += 2 * spacing) {
    let factor = (i * 1) / dist;
    retval.push({ x: a.x + factor * dx, y: a.y + factor * dy });
  }
  return retval;
}

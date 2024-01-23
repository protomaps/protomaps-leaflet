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
  targetLen: number,
): LabelableSegment[] => {
  const chunks = [];
  let a;
  let b;
  let c;
  let i = 0;
  let n = 0;
  let d = 0;
  let abmag = 0;
  let bcmag = 0;
  let abx = 0;
  let aby = 0;
  let bcx = 0;
  let bcy = 0;
  let dt = 0;
  let i_start = 0;
  let d_start = 0;

  if (pts.length < 2) return [];
  if (pts.length === 2) {
    d = Math.sqrt((pts[1].x - pts[0].x) ** 2 + (pts[1].y - pts[0].y) ** 2);

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

  abmag = Math.sqrt((pts[1].x - pts[0].x) ** 2 + (pts[1].y - pts[0].y) ** 2);
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
  cellSize: number,
): LabelCandidate[] {
  let longestStart;
  let longestEnd;
  const longestLength = 0;

  const candidates = [];

  const lastLabeledDistance = -Infinity;

  for (const ls of mls) {
    const segments = linelabel(ls, Math.PI / 45, minimum); // 4 degrees, close to a straight line
    for (const segment of segments) {
      if (segment.length >= minimum + cellSize) {
        const start = new Point(
          ls[segment.beginIndex].x,
          ls[segment.beginIndex].y,
        );
        const end = ls[segment.endIndex - 1];
        const normalized = new Point(
          (end.x - start.x) / segment.length,
          (end.y - start.y) / segment.length,
        );

        // offset from the start by cellSize to allow streets that meet at right angles
        // to both be labeled.
        for (
          let i = cellSize;
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
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

  const retval = [];
  // starting from the anchor, generate square cells,
  // guaranteeing to cover the endpoint
  for (let i = 0; i < length + spacing; i += 2 * spacing) {
    const factor = (i * 1) / dist;
    retval.push({ x: a.x + factor * dx, y: a.y + factor * dy });
  }
  return retval;
}

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
  maxAngleDelta: number,
  targetLen: number,
): LabelableSegment[] => {
  const chunks = [];
  let a: Point;
  let b: Point;
  let c: Point;
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
  let iStart = 0;
  let dStart = 0;

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
    if (dt > maxAngleDelta || d - dStart > targetLen) {
      chunks.push({
        length: d - dStart,
        beginDistance: dStart,
        beginIndex: iStart,
        endIndex: i + 1,
        endDistance: d,
      });
      iStart = i;
      dStart = d;
    }
    abmag = bcmag;
  }

  if (i - iStart > 0) {
    chunks.push({
      length: d - dStart + bcmag,
      beginIndex: iStart,
      beginDistance: dStart,
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
  mls: Point[][],
  minimum: number,
  repeatDistance: number,
  cellSize: number,
): LabelCandidate[] {
  const candidates = [];

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

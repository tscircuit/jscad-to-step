import type { Vec3 as Point } from "./vec-math"

/** Reject crossing or almost-touching trimming edges, including between holes.
 * Such regions retain their original polygons instead of producing invalid wires.
 */
export function simpleBoundaries(
  loops: number[][],
  points: Point[],
  normal: Point,
) {
  const drop = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)))
  const axes = [0, 1, 2].filter((axis) => axis !== drop)
  type P2 = [number, number]
  const project = (id: number): P2 => [
    points[id]![axes[0]!]!,
    points[id]![axes[1]!]!,
  ]
  const distance = (p: P2, a: P2, b: P2) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1]
    const t = Math.max(
      0,
      Math.min(
        1,
        ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy),
      ),
    )
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
  }
  const orient = (a: P2, b: P2, c: P2) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const edges = loops.flatMap((loop, ring) =>
    loop.map((id, index) => ({
      a: project(id),
      b: project(loop[(index + 1) % loop.length]!),
      ring,
      index,
      count: loop.length,
    })),
  )
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!
    for (let j = i + 1; j < edges.length; j++) {
      const f = edges[j]!
      if (
        e.ring === f.ring &&
        (j === i + 1 || f.index - e.index === e.count - 1)
      )
        continue
      if (
        [0, 1].some(
          (axis) =>
            Math.max(e.a[axis]!, e.b[axis]!) + 1e-9 <
              Math.min(f.a[axis]!, f.b[axis]!) ||
            Math.max(f.a[axis]!, f.b[axis]!) + 1e-9 <
              Math.min(e.a[axis]!, e.b[axis]!),
        )
      )
        continue
      if (
        orient(e.a, e.b, f.a) * orient(e.a, e.b, f.b) < 0 &&
        orient(f.a, f.b, e.a) * orient(f.a, f.b, e.b) < 0
      )
        return false
      if (
        Math.min(
          distance(e.a, f.a, f.b),
          distance(e.b, f.a, f.b),
          distance(f.a, e.a, e.b),
          distance(f.b, e.a, e.b),
        ) <= 1e-9
      )
        return false
    }
  }
  return true
}

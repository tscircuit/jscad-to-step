import { simpleBoundaries } from "./planar-boundaries"
import { type Vec3 as Point, vertexKey, newellNormal } from "./vec-math"

interface PlanarRegion {
  loops: number[][]
  normal: Point
}

export interface PlanarFace {
  /** Outer boundary followed by hole boundaries, with their original winding. */
  loops: Point[][]
  normal: Point
}

/** Merge adjacent planar polygons after transforms and T-junction splitting.
 * Adapted from jscad-to-parasolid's boundary extraction; no serializer dependency.
 * Keep all boundary vertices so neighbouring faces continue to share full edges.
 */
export function mergeCoplanarFaces(
  polygons: Point[][],
  enabled = true,
): PlanarFace[] {
  if (!enabled)
    return polygons.map((polygon) => ({
      loops: [polygon],
      normal: newellNormal(polygon),
    }))
  const points: Point[] = []
  const ids = new Map<string, number>()
  const cycles = polygons.map((polygon) =>
    polygon.map((point) => {
      const k = vertexKey(point)
      let id = ids.get(k)
      if (id === undefined) {
        id = points.length
        ids.set(k, id)
        points.push(point)
      }
      return id
    }),
  )
  // Use the same metre-based tolerances as the Parasolid converter.
  const metres = points.map((p) => p.map((v) => v * 0.001) as Point)
  return mergeCoplanarRegions(metres, cycles).map((region) => ({
    loops: region.loops.map((loop) => loop.map((id) => points[id]!)),
    normal: region.normal,
  }))
}

const sub = (a: Point, b: Point): Point => a.map((v, i) => v - b[i]!) as Point
const dot = (a: Point, b: Point) => a.reduce((s, v, i) => s + v * b[i]!, 0)
const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const key = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`)
function areaVector(loop: number[], points: Point[]): Point {
  const origin = points[loop[0]!]!
  const area: Point = [0, 0, 0]
  for (let i = 1; i < loop.length - 1; i++) {
    const c = cross(
      sub(points[loop[i]!]!, origin),
      sub(points[loop[i + 1]!]!, origin),
    )
    for (let axis = 0; axis < 3; axis++) area[axis]! += c[axis]!
  }
  return area
}

/** Input must already be welded, T-junction split, manifold and oriented.
 * Points are in metres. Boundary vertices are retained for neighbouring faces.
 */
function mergeCoplanarRegions(
  points: Point[],
  cycles: number[][],
): PlanarRegion[] {
  const normals = cycles.map((cycle) => {
    const area = areaVector(cycle, points)
    const magnitude = Math.hypot(...area)
    return magnitude
      ? (area.map((v) => v / magnitude) as Point)
      : ([0, 0, 0] as Point)
  })
  const uses = new Map<string, number[]>()
  cycles.forEach((cycle, face) =>
    cycle.forEach((a, i) => {
      const k = key(a, cycle[(i + 1) % cycle.length]!)
      const list = uses.get(k) ?? []
      list.push(face)
      uses.set(k, list)
    }),
  )
  const visited = new Set<number>()
  const regions: PlanarRegion[] = []
  for (let seed = 0; seed < cycles.length; seed++) {
    if (visited.has(seed)) continue
    const normal = normals[seed]!
    const origin = points[cycles[seed]![0]!]!
    const matches = (face: number) => {
      return (
        dot(normal, normals[face]!) > 0 &&
        Math.hypot(...cross(normal, normals[face]!)) <= 1e-10 &&
        cycles[face]!.every(
          (id) => Math.abs(dot(sub(points[id]!, origin), normal)) <= 1e-9,
        )
      )
    }
    const group = [seed]
    visited.add(seed)
    for (let i = 0; i < group.length; i++) {
      const cycle = cycles[group[i]!]!
      cycle.forEach((a, j) => {
        const neighbours = uses.get(key(a, cycle[(j + 1) % cycle.length]!))!
        if (neighbours.length !== 2) return
        for (const other of neighbours) {
          if (visited.has(other) || !matches(other)) continue
          visited.add(other)
          group.push(other)
        }
      })
    }
    if (group.length === 1) {
      regions.push({
        loops: [cycles[seed]!],
        normal: newellNormal(cycles[seed]!.map((id) => points[id]!)),
      })
      continue
    }
    const members = new Set(group)
    const boundary = new Map<number, number>()
    let ambiguous = false
    for (const face of group) {
      const cycle = cycles[face]!
      cycle.forEach((a, j) => {
        const b = cycle[(j + 1) % cycle.length]!
        const incident = uses.get(key(a, b))!
        if (incident.length > 2) ambiguous = true
        if (
          incident.length === 2 &&
          incident.every((other) => members.has(other))
        ) {
          const other = cycles[incident.find((id) => id !== face)!]!
          if (
            !other?.some(
              (v, i) => v === b && other[(i + 1) % other.length] === a,
            )
          )
            ambiguous = true
          return
        }
        if (boundary.has(a)) ambiguous = true
        boundary.set(a, b)
      })
    }
    const loops: number[][] = []
    while (!ambiguous && boundary.size) {
      const start = boundary.keys().next().value!
      const loop: number[] = []
      let current = start
      do {
        const next = boundary.get(current)
        if (next === undefined) {
          ambiguous = true
          break
        }
        loop.push(current)
        boundary.delete(current)
        current = next
      } while (current !== start)
      if (loop.length < 3) ambiguous = true
      loops.push(loop)
    }
    // A point-touching patch cannot be represented by simple trimming loops.
    // Retain its original faces, rather than changing topology.
    if (ambiguous || loops.length === 0) {
      for (const face of group)
        regions.push({
          loops: [cycles[face]!],
          normal: normals[face]!,
        })
      continue
    }
    const outer = loops.filter(
      (loop) => dot(areaVector(loop, points), normal) > 0,
    )
    if (outer.length !== 1 || !simpleBoundaries(loops, points, normal)) {
      for (const face of group)
        regions.push({
          loops: [cycles[face]!],
          normal: normals[face]!,
        })
      continue
    }
    regions.push({
      loops: [outer[0]!, ...loops.filter((loop) => loop !== outer[0])],
      normal,
    })
  }
  return regions
}

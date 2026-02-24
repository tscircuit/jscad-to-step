import {
  AdvancedFace,
  Axis2Placement3D,
  CartesianPoint,
  Direction,
  EdgeCurve,
  EdgeLoop,
  FaceBound,
  FaceOuterBound,
  Line,
  OrientedEdge,
  Plane,
  type Ref,
  type Repository,
  Vector,
  VertexPoint,
} from "stepts"
import {
  type Vec3,
  subtract,
  cross,
  dot,
  lengthSq,
  normalize,
  newellNormal,
  applyTransform,
  vertexKey,
  cleanVec3,
} from "./vec-math.ts"

interface Polygon {
  vertices: Array<Vec3 | { pos?: number[]; position?: number[] } | number[]>
}

interface Geom3 {
  polygons: Polygon[]
  transforms?: number[]
  color?: number[]
}

function extractPosition(vertex: any): Vec3 {
  if (Array.isArray(vertex) && vertex.length >= 3) {
    return [
      Number(vertex[0]) || 0,
      Number(vertex[1]) || 0,
      Number(vertex[2]) || 0,
    ]
  }
  if (vertex?.pos && Array.isArray(vertex.pos) && vertex.pos.length >= 3) {
    return [
      Number(vertex.pos[0]) || 0,
      Number(vertex.pos[1]) || 0,
      Number(vertex.pos[2]) || 0,
    ]
  }
  if (
    vertex?.position &&
    Array.isArray(vertex.position) &&
    vertex.position.length >= 3
  ) {
    return [
      Number(vertex.position[0]) || 0,
      Number(vertex.position[1]) || 0,
      Number(vertex.position[2]) || 0,
    ]
  }
  return [0, 0, 0]
}

/**
 * Check if point P lies strictly between A and B on segment AB.
 * Returns true if P is on the line AB and between A and B (not at endpoints).
 */
function pointOnSegment(a: Vec3, b: Vec3, p: Vec3, eps: number): boolean {
  const ab = subtract(b, a)
  const ap = subtract(p, a)
  const abLen2 = lengthSq(ab)
  if (abLen2 < eps * eps) return false

  // Check colinearity: |cross(AB, AP)| / |AB| < eps
  const cp = cross(ab, ap)
  const crossLen2 = lengthSq(cp)
  if (crossLen2 > eps * eps * abLen2) return false

  // Check parameter t: P = A + t*(B-A), need 0 < t < 1
  const t = dot(ap, ab) / abLen2
  return t > eps && t < 1 - eps
}

/**
 * Split polygon edges at T-junction vertices.
 * For each edge in each polygon, if any vertex from another polygon lies
 * on that edge, insert it to split the edge.
 */
function splitTJunctions(polygons: Vec3[][]): Vec3[][] {
  // Collect all unique vertices
  const allVertices = new Map<string, Vec3>()
  for (const poly of polygons) {
    for (const v of poly) {
      allVertices.set(vertexKey(v), v)
    }
  }
  const vertexList = Array.from(allVertices.values())

  const result: Vec3[][] = []
  for (const poly of polygons) {
    const newPoly: Vec3[] = []
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!
      const b = poly[(i + 1) % poly.length]!
      newPoly.push(a)

      // Find vertices that lie on this edge segment
      const aKey = vertexKey(a)
      const bKey = vertexKey(b)
      const ab = subtract(b, a)
      const abLen2 = lengthSq(ab)
      if (abLen2 < 1e-14) continue

      const intermediates: { t: number; v: Vec3 }[] = []
      for (const v of vertexList) {
        const vKey = vertexKey(v)
        if (vKey === aKey || vKey === bKey) continue
        if (pointOnSegment(a, b, v, 1e-6)) {
          const ap = subtract(v, a)
          const t = dot(ap, ab) / abLen2
          intermediates.push({ t, v })
        }
      }

      // Sort by parameter t and insert
      if (intermediates.length > 0) {
        intermediates.sort((x, y) => x.t - y.t)
        for (const { v } of intermediates) {
          newPoly.push(v)
        }
      }
    }
    result.push(newPoly)
  }
  return result
}

/**
 * Compute a key for a polygon's plane (normal direction + distance from origin).
 * Coplanar polygons share the same plane key.
 */
function planeKey(normal: Vec3, point: Vec3): string {
  // Snap near-zero components to 0 before canonicalization
  let n = normalize(normal)
  n = [
    Math.abs(n[0]) < 1e-8 ? 0 : n[0],
    Math.abs(n[1]) < 1e-8 ? 0 : n[1],
    Math.abs(n[2]) < 1e-8 ? 0 : n[2],
  ] as Vec3
  n = normalize(n)
  // Pick canonical direction: first non-zero component should be positive
  if (n[0] < -1e-8 || (Math.abs(n[0]) < 1e-8 && n[1] < -1e-8) ||
      (Math.abs(n[0]) < 1e-8 && Math.abs(n[1]) < 1e-8 && n[2] < -1e-8)) {
    n = [-n[0], -n[1], -n[2]] as Vec3
  }
  const d = dot(n, point)
  // Round to 4 decimal places to group near-coplanar faces
  const nk = `${n[0].toFixed(4)},${n[1].toFixed(4)},${n[2].toFixed(4)}`
  const dk = d.toFixed(4)
  return `${nk}|${dk}`
}

/**
 * Merge coplanar adjacent polygons into single polygons.
 * For each group of coplanar polygons, find the boundary edges,
 * assemble them into loops (outer boundary + inner holes).
 */
function mergeCoplanarPolygons(polygons: Vec3[][]): Vec3[][][] {
  // Compute normal for each polygon using Newell method (robust for colinear vertices)
  const normals: Vec3[] = []
  for (const poly of polygons) {
    if (poly.length < 3) {
      normals.push([0, 0, 1])
      continue
    }
    normals.push(newellNormal(poly))
  }

  // Group by plane
  const groups = new Map<string, number[]>()
  for (let i = 0; i < polygons.length; i++) {
    const poly = polygons[i]!
    if (poly.length < 3) continue
    const key = planeKey(normals[i]!, poly[0]!)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(i)
  }

  const result: Vec3[][][] = []

  for (const [, indices] of groups) {
    if (indices.length === 1) {
      // Single polygon, no merging needed
      result.push([polygons[indices[0]!]!])
      continue
    }

    // Collect directed edges from all polygons in this group
    // An edge used by 2 polygons is internal (remove), used by 1 is boundary (keep)
    const edgeCount = new Map<string, number>()
    const edgeDir = new Map<string, [Vec3, Vec3]>() // canonical key -> [start, end] in first polygon's winding

    for (const idx of indices) {
      const poly = polygons[idx]!
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i]!
        const b = poly[(i + 1) % poly.length]!
        const aKey = vertexKey(a)
        const bKey = vertexKey(b)
        if (aKey === bKey) continue
        const canonical = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`
        edgeCount.set(canonical, (edgeCount.get(canonical) || 0) + 1)
        if (!edgeDir.has(canonical)) {
          edgeDir.set(canonical, [a, b])
        }
      }
    }

    // Boundary edges: used by exactly 1 polygon
    const boundaryEdges: [Vec3, Vec3][] = []
    for (const [canonical, count] of edgeCount) {
      if (count === 1) {
        boundaryEdges.push(edgeDir.get(canonical)!)
      }
    }

    if (boundaryEdges.length === 0) {
      // All edges are internal? Shouldn't happen. Keep originals.
      for (const idx of indices) {
        result.push([polygons[idx]!])
      }
      continue
    }

    // Build adjacency for boundary edges
    const fromVertex = new Map<string, [Vec3, Vec3][]>()
    for (const [a, b] of boundaryEdges) {
      const aKey = vertexKey(a)
      if (!fromVertex.has(aKey)) fromVertex.set(aKey, [])
      fromVertex.get(aKey)!.push([a, b])
    }

    // Assemble boundary edges into closed loops
    const usedEdges = new Set<string>()
    const loops: Vec3[][] = []

    for (const [a, b] of boundaryEdges) {
      const startKey = vertexKey(a)
      const edgeId = `${startKey}|${vertexKey(b)}`
      if (usedEdges.has(edgeId)) continue

      const loop: Vec3[] = [a]
      let current = b
      usedEdges.add(edgeId)

      while (vertexKey(current) !== startKey) {
        loop.push(current)
        const curKey = vertexKey(current)
        const nextEdges = fromVertex.get(curKey)
        if (!nextEdges) break

        let found = false
        for (const [ea, eb] of nextEdges) {
          const eid = `${vertexKey(ea)}|${vertexKey(eb)}`
          if (!usedEdges.has(eid)) {
            usedEdges.add(eid)
            current = eb
            found = true
            break
          }
        }
        if (!found) break
      }

      if (loop.length >= 3) {
        loops.push(loop)
      }
    }

    if (loops.length === 0) {
      // Fallback: keep original polygons
      for (const idx of indices) {
        result.push([polygons[idx]!])
      }
      continue
    }

    // Compute area of each loop to determine outer vs inner
    // Use the polygon's plane normal to compute signed area
    const refNormal = normals[indices[0]!]!
    const loopAreas: { loop: Vec3[]; signedArea: number }[] = []
    for (const loop of loops) {
      let area = 0
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i]!
        const b = loop[(i + 1) % loop.length]!
        const cp = cross(a, b)
        area += dot(cp, refNormal)
      }
      loopAreas.push({ loop, signedArea: area / 2 })
    }

    // Sort by absolute area descending - largest is outer boundary
    loopAreas.sort((a, b) => Math.abs(b.signedArea) - Math.abs(a.signedArea))

    // The outer loop should have positive signed area (CCW when viewed from normal direction)
    // Inner holes should have negative signed area (CW)
    const outerLoop = loopAreas[0]!
    const mergedFace: Vec3[][] = []

    // If outer loop area is negative, reverse it
    if (outerLoop.signedArea < 0) {
      outerLoop.loop.reverse()
    }
    mergedFace.push(outerLoop.loop)

    // Inner loops (holes) - should have opposite winding from outer
    for (let i = 1; i < loopAreas.length; i++) {
      const innerLoop = loopAreas[i]!
      // Inner loops should have negative area (CW when viewed from normal)
      if (innerLoop.signedArea > 0) {
        innerLoop.loop.reverse()
      }
      mergedFace.push(innerLoop.loop)
    }

    result.push(mergedFace)
  }

  return result
}

/**
 * Convert a geom3 (polygon mesh) into STEP B-Rep topology entities in the given repository.
 * Returns an array of AdvancedFace refs that can be used in a ClosedShell.
 */
export function geom3ToBrep(
  repo: Repository,
  geom: Geom3,
): Ref<AdvancedFace>[] {
  const vertexMap = new Map<string, Ref<VertexPoint>>()
  const edgeMap = new Map<string, Ref<EdgeCurve>>()

  function getOrCreateVertex(pos: Vec3): Ref<VertexPoint> {
    const key = vertexKey(pos)
    let ref = vertexMap.get(key)
    if (!ref) {
      const clean = cleanVec3(pos)
      const pt = repo.add(new CartesianPoint("", clean[0], clean[1], clean[2]))
      ref = repo.add(new VertexPoint("", pt))
      vertexMap.set(key, ref)
    }
    return ref
  }

  function canonicalEdgeKey(aKey: string, bKey: string): string {
    return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`
  }

  function getOrCreateEdge(
    aPos: Vec3,
    bPos: Vec3,
    aRef: Ref<VertexPoint>,
    bRef: Ref<VertexPoint>,
  ): { edgeRef: Ref<EdgeCurve>; sameDirection: boolean } {
    const aKey = vertexKey(aPos)
    const bKey = vertexKey(bPos)
    const eKey = canonicalEdgeKey(aKey, bKey)

    let edgeRef = edgeMap.get(eKey)
    if (!edgeRef) {
      // Create edge in canonical direction (aKey < bKey)
      const startRef = aKey < bKey ? aRef : bRef
      const endRef = aKey < bKey ? bRef : aRef
      const startPos = aKey < bKey ? aPos : bPos
      const endPos = aKey < bKey ? bPos : aPos

      const d = cleanVec3(normalize(subtract(endPos, startPos)))
      const dir = repo.add(new Direction("", d[0], d[1], d[2]))
      const vec = repo.add(new Vector("", dir, 1))
      const startPt = startRef.resolve(repo).pnt
      const line = repo.add(new Line("", startPt, vec))
      edgeRef = repo.add(new EdgeCurve("", startRef, endRef, line, true))
      edgeMap.set(eKey, edgeRef)
    }

    // sameDirection = polygon traversal goes in same direction as canonical edge
    const sameDirection = aKey < bKey
    return { edgeRef, sameDirection }
  }

  // Transform all polygon vertices
  let rawPolygons: Vec3[][] = []
  for (const polygon of geom.polygons) {
    if (!polygon?.vertices || polygon.vertices.length < 3) continue
    const positions: Vec3[] = polygon.vertices.map((v) => {
      const pos = extractPosition(v)
      return applyTransform(pos, geom.transforms)
    })
    rawPolygons.push(positions)
  }

  // Split edges at T-junctions
  rawPolygons = splitTJunctions(rawPolygons)

  // Merge coplanar adjacent polygons to avoid OCCT tessellation gaps
  const mergedFaces = mergeCoplanarPolygons(rawPolygons)

  const faces: Ref<AdvancedFace>[] = []

  function buildLoop(positions: Vec3[]): Ref<OrientedEdge>[] | null {
    // Deduplicate consecutive identical vertices
    const uniquePositions: Vec3[] = []
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i]!
      const prev = i > 0 ? positions[i - 1]! : positions[positions.length - 1]!
      if (vertexKey(pos) !== vertexKey(prev)) {
        uniquePositions.push(pos)
      }
    }

    if (uniquePositions.length < 3) return null

    const vRefs = uniquePositions.map((pos) => getOrCreateVertex(pos))
    const orientedEdges: Ref<OrientedEdge>[] = []

    for (let i = 0; i < uniquePositions.length; i++) {
      const aPos = uniquePositions[i]!
      const bPos = uniquePositions[(i + 1) % uniquePositions.length]!
      const aRef = vRefs[i]!
      const bRef = vRefs[(i + 1) % uniquePositions.length]!

      if (vertexKey(aPos) === vertexKey(bPos)) continue

      const { edgeRef, sameDirection } = getOrCreateEdge(aPos, bPos, aRef, bRef)
      orientedEdges.push(repo.add(new OrientedEdge("", edgeRef, sameDirection)))
    }

    return orientedEdges.length >= 3 ? orientedEdges : null
  }

  for (const loops of mergedFaces) {
    const outerLoop = loops[0]!
    const outerEdges = buildLoop(outerLoop)
    if (!outerEdges) continue

    // Compute face normal using Newell method (robust for colinear vertices)
    const uniqueOuter: Vec3[] = []
    for (let i = 0; i < outerLoop.length; i++) {
      const pos = outerLoop[i]!
      const prev = i > 0 ? outerLoop[i - 1]! : outerLoop[outerLoop.length - 1]!
      if (vertexKey(pos) !== vertexKey(prev)) {
        uniqueOuter.push(pos)
      }
    }
    if (uniqueOuter.length < 3) continue

    const normal = cleanVec3(newellNormal(uniqueOuter))

    // Create plane
    const v0 = uniqueOuter[0]!
    const cleanV0 = cleanVec3(v0)
    const planeOrigin = repo.add(new CartesianPoint("", cleanV0[0], cleanV0[1], cleanV0[2]))
    const planeNormal = repo.add(
      new Direction("", normal[0], normal[1], normal[2]),
    )

    // Compute ref direction: find a non-degenerate edge for the in-plane reference
    let refVec: Vec3 = [1, 0, 0]
    for (let i = 0; i < uniqueOuter.length; i++) {
      const edgeDir = subtract(uniqueOuter[(i + 1) % uniqueOuter.length]!, uniqueOuter[i]!)
      if (lengthSq(edgeDir) > 1e-14) {
        refVec = normalize(edgeDir)
        break
      }
    }
    const edge0Dir = cleanVec3(refVec)
    const refDir = repo.add(
      new Direction("", edge0Dir[0], edge0Dir[1], edge0Dir[2]),
    )

    const placement = repo.add(
      new Axis2Placement3D("", planeOrigin, planeNormal, refDir),
    )
    const plane = repo.add(new Plane("", placement))

    // Build face bounds
    const bounds: Ref<FaceOuterBound>[] = []

    const outerEdgeLoop = repo.add(new EdgeLoop("", outerEdges))
    bounds.push(repo.add(new FaceOuterBound("", outerEdgeLoop, true)))

    // Add inner holes
    for (let i = 1; i < loops.length; i++) {
      const innerEdges = buildLoop(loops[i]!)
      if (innerEdges) {
        const innerEdgeLoop = repo.add(new EdgeLoop("", innerEdges))
        bounds.push(repo.add(new FaceBound("", innerEdgeLoop, true)) as unknown as Ref<FaceOuterBound>)
      }
    }

    const face = repo.add(new AdvancedFace("", bounds, plane, true))
    faces.push(face)
  }

  return faces
}

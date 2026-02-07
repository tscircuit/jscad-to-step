import {
  AdvancedFace,
  Axis2Placement3D,
  CartesianPoint,
  Direction,
  EdgeCurve,
  EdgeLoop,
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
  normalize,
  applyTransform,
  vertexKey,
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
 * Convert a geom3 (polygon mesh) into STEP B-Rep topology entities in the given repository.
 * Returns an array of AdvancedFace refs that can be used in a ClosedShell.
 */
export function geom3ToBrep(
  repo: Repository,
  geom: Geom3,
): Ref<AdvancedFace>[] {
  const vertexMap = new Map<string, Ref<VertexPoint>>()
  const edgeMap = new Map<string, Ref<EdgeCurve>>()
  // Track canonical direction for each edge so we can set OrientedEdge orientation
  const edgeDirection = new Map<string, [string, string]>() // edgeKey -> [startKey, endKey]

  function getOrCreateVertex(pos: Vec3): Ref<VertexPoint> {
    const key = vertexKey(pos)
    let ref = vertexMap.get(key)
    if (!ref) {
      const pt = repo.add(new CartesianPoint("", pos[0], pos[1], pos[2]))
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

      const d = normalize(subtract(endPos, startPos))
      const dir = repo.add(new Direction("", d[0], d[1], d[2]))
      const vec = repo.add(new Vector("", dir, 1))
      const startPt = startRef.resolve(repo).pnt
      const line = repo.add(new Line("", startPt, vec))
      edgeRef = repo.add(new EdgeCurve("", startRef, endRef, line, true))
      edgeMap.set(eKey, edgeRef)
      edgeDirection.set(eKey, [
        aKey < bKey ? aKey : bKey,
        aKey < bKey ? bKey : aKey,
      ])
    }

    // sameDirection = polygon traversal goes in same direction as canonical edge
    const sameDirection = aKey < bKey
    return { edgeRef, sameDirection }
  }

  const faces: Ref<AdvancedFace>[] = []

  for (const polygon of geom.polygons) {
    if (!polygon?.vertices || polygon.vertices.length < 3) continue

    // Transform vertices
    const positions: Vec3[] = polygon.vertices.map((v) => {
      const pos = extractPosition(v)
      return applyTransform(pos, geom.transforms)
    })

    // Deduplicate consecutive identical vertices
    const uniquePositions: Vec3[] = []
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i]!
      const prev = i > 0 ? positions[i - 1]! : positions[positions.length - 1]!
      if (vertexKey(pos) !== vertexKey(prev)) {
        uniquePositions.push(pos)
      }
    }

    if (uniquePositions.length < 3) continue

    // Get/create vertex refs
    const vertexRefs = uniquePositions.map((pos) => getOrCreateVertex(pos))

    // Build oriented edges
    const orientedEdges: Ref<OrientedEdge>[] = []
    let hasDegenerate = false

    for (let i = 0; i < uniquePositions.length; i++) {
      const aPos = uniquePositions[i]!
      const bPos = uniquePositions[(i + 1) % uniquePositions.length]!
      const aRef = vertexRefs[i]!
      const bRef = vertexRefs[(i + 1) % uniquePositions.length]!

      // Skip degenerate edges
      if (vertexKey(aPos) === vertexKey(bPos)) {
        hasDegenerate = true
        continue
      }

      const { edgeRef, sameDirection } = getOrCreateEdge(aPos, bPos, aRef, bRef)
      orientedEdges.push(repo.add(new OrientedEdge("", edgeRef, sameDirection)))
    }

    if (orientedEdges.length < 3) continue

    // Compute face normal from first three unique vertices
    const v0 = uniquePositions[0]!
    const v1 = uniquePositions[1]!
    const v2 = uniquePositions[2]!
    const ab = subtract(v1, v0)
    const ac = subtract(v2, v0)
    const normal = normalize(cross(ab, ac))

    // Create plane
    const planeOrigin = repo.add(new CartesianPoint("", v0[0], v0[1], v0[2]))
    const planeNormal = repo.add(
      new Direction("", normal[0], normal[1], normal[2]),
    )

    // Compute ref direction (perpendicular to normal, in the plane)
    const edge0Dir = normalize(ab)
    const refDir = repo.add(
      new Direction("", edge0Dir[0], edge0Dir[1], edge0Dir[2]),
    )

    const placement = repo.add(
      new Axis2Placement3D("", planeOrigin, planeNormal, refDir),
    )
    const plane = repo.add(new Plane("", placement))

    const edgeLoop = repo.add(new EdgeLoop("", orientedEdges))
    const faceOuterBound = repo.add(new FaceOuterBound("", edgeLoop, true))
    const face = repo.add(new AdvancedFace("", [faceOuterBound], plane, true))
    faces.push(face)
  }

  return faces
}

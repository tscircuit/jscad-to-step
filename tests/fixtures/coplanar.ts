import { expect } from "bun:test"
import {
  AdvancedFace,
  EdgeCurve,
  FaceBound,
  FaceOuterBound,
  OrientedEdge,
  Plane,
  parseRepository,
} from "stepts"

export function inspectFaces(text: string) {
  const repo = parseRepository(text)
  const entries = repo.entries().map(([, entity]) => entity)
  const faces = entries.filter((entity) => entity instanceof AdvancedFace)
  const horizontal = faces.filter((face) => {
    const plane = face.surface.resolve(repo) as Plane
    const axis = plane.placement.resolve(repo).axis!.resolve(repo)
    return Math.abs(axis.dz) > 1 - 1e-10
  })
  return { repo, entries, faces, horizontal }
}

export function expectClosedTopology(text: string) {
  const { repo, entries, faces } = inspectFaces(text)
  const uses = new Map<number, boolean[]>()
  for (const face of faces) {
    for (const ref of face.bounds) {
      const bound = ref.resolve(repo)
      expect(
        bound instanceof FaceBound || bound instanceof FaceOuterBound,
      ).toBe(true)
      const loop = bound.bound.resolve(repo)
      const oriented = loop.edges.map((ref) => ref.resolve(repo))
      expect(oriented.length).toBeGreaterThanOrEqual(3)
      oriented.forEach((item, i) => {
        const edge = item.edge.resolve(repo)
        const next = oriented[(i + 1) % oriented.length]!
        const nextEdge = next.edge.resolve(repo)
        expect(item.orientation ? edge.end.id : edge.start.id).toBe(
          next.orientation ? nextEdge.start.id : nextEdge.end.id,
        )
        const list = uses.get(item.edge.id) ?? []
        list.push(item.orientation)
        uses.set(item.edge.id, list)
      })
    }
  }
  expect(uses.size).toBe(entries.filter((e) => e instanceof EdgeCurve).length)
  for (const orientations of uses.values()) {
    expect(orientations).toHaveLength(2)
    expect(orientations[0]).not.toBe(orientations[1])
  }
  expect(entries.filter((e) => e instanceof OrientedEdge).length).toBe(
    uses.size * 2,
  )
}

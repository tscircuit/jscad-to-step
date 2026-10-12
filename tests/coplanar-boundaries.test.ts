import { expect, test } from "bun:test"
import { mergeCoplanarFaces } from "../lib/merge-coplanar"
import type { Vec3 } from "../lib/vec-math"

test("only compatible adjacent planes merge; ambiguous boundaries retain their polygons", () => {
  const a: Vec3[] = [
    [0, 0, 0],
    [2, 0, 0],
    [0, 2, 0],
  ]
  const b: Vec3[] = [
    [2, 0, 0],
    [2, 2, 0],
    [0, 2, 0],
  ]
  expect(mergeCoplanarFaces([a, b])).toHaveLength(1)
  expect(mergeCoplanarFaces([a, b], false)).toHaveLength(2)
  const tilted: Vec3[] = [
    [2, 0, 0],
    [2, 2, 0.001],
    [0, 2, 0],
  ]
  expect(mergeCoplanarFaces([a, tilted])).toHaveLength(2)
  const disconnected = a.map(([x, y, z]) => [x + 4, y, z] as Vec3)
  expect(mergeCoplanarFaces([a, disconnected])).toHaveLength(2)
  const pointTouching = a.map(([x, y, z]) => [-x, -y, z] as Vec3)
  expect(mergeCoplanarFaces([a, pointTouching])).toHaveLength(2)
  expect(mergeCoplanarFaces([a, b, b])).toHaveLength(3)
  // One shared edge, but overlapping boundaries cross after joining the triangles.
  const crossing: Vec3[] = [
    [2, 0, 0],
    [-1, 0, 0],
    [0, 2, 0],
  ]
  expect(mergeCoplanarFaces([a, crossing])).toHaveLength(2)
})

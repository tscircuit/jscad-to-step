import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { FaceBound, FaceOuterBound } from "stepts"
import { jscadToStep } from "../lib"
import { expectClosedTopology, inspectFaces } from "./fixtures/coplanar"

test("gear-shaped extrusion has single planar caps and retains its bore", async () => {
  const points = Array.from({ length: 64 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 64
    const radius = i % 4 === 0 || i % 4 === 3 ? 9 : 11
    return [radius * Math.cos(angle), radius * Math.sin(angle)] as [
      number,
      number,
    ]
  })
  const gear = jscad.booleans.subtract(
    jscad.extrusions.extrudeLinear(
      { height: 4 },
      jscad.primitives.polygon({ points }),
    ),
    jscad.primitives.cylinder({
      radius: 2,
      height: 8,
      segments: 32,
      center: [0, 0, 2],
    }),
  )
  const model = { geometries: [{ geom: gear }] }
  const before = structuredClone(model)
  const merged = jscadToStep(model)
  const original = jscadToStep(model, { mergeCoplanarFaces: false })
  const { repo, faces, horizontal } = inspectFaces(merged)
  expect(horizontal).toHaveLength(2)
  expect(faces.length).toBeLessThan(inspectFaces(original).faces.length)
  for (const cap of horizontal) {
    expect(cap.bounds).toHaveLength(2)
    expect(cap.bounds[0]!.resolve(repo)).toBeInstanceOf(FaceOuterBound)
    expect(cap.bounds[1]!.resolve(repo)).toBeInstanceOf(FaceBound)
    expect(
      cap.bounds[1]!.resolve(repo).bound.resolve(repo).edges.length,
    ).toBeGreaterThanOrEqual(32)
  }
  expectClosedTopology(merged)
  expect(model).toEqual(before)
  await expect(merged).toMatchStepSnapshot(import.meta.path, "coplanar-gear")
}, 30_000)

import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { jscadToStep } from "../lib"
import { expectClosedTopology, inspectFaces } from "./fixtures/coplanar"

test("merging retains shared T-junction boundary vertices and separate colored bodies", async () => {
  const cube = jscad.primitives.cube({ size: 4 })
  const vertices = cube.polygons[0]!.vertices
  const mid = vertices[0]!.map((v, axis) => (v + vertices[1]![axis]!) / 2)
  const geom = {
    polygons: [
      { vertices: [vertices[0]!, mid, vertices[3]!] },
      { vertices: [mid, vertices[1]!, vertices[2]!] },
      { vertices: [mid, vertices[2]!, vertices[3]!] },
      ...cube.polygons.slice(1),
    ],
  }
  const merged = jscadToStep({ geometries: [{ geom }] })
  const original = jscadToStep(
    { geometries: [{ geom }] },
    { mergeCoplanarFaces: false },
  )
  expect(inspectFaces(merged).faces).toHaveLength(6)
  expect(inspectFaces(original).faces).toHaveLength(8)
  expectClosedTopology(merged)
  const bodies = jscadToStep({
    geometries: [
      { geom, color: [1, 0, 0] },
      { geom: jscad.transforms.translate([6, 0, 0], cube), color: [0, 0, 1] },
    ],
  })
  expect(inspectFaces(bodies).faces).toHaveLength(12)
  expect(bodies.match(/MANIFOLD_SOLID_BREP/g)).toHaveLength(2)
  expect(bodies.match(/STYLED_ITEM/g)).toHaveLength(2)
  expectClosedTopology(bodies)
  await expect(bodies).toMatchStepSnapshot(
    import.meta.path,
    "coplanar-t-junction",
  )
}, 30_000)

import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { jscadToStep } from "../lib"
import { expectClosedTopology, inspectFaces } from "./fixtures/coplanar"

test("transformed plate keeps multiple holes and its CAD geometry", async () => {
  const plate = jscad.booleans.subtract(
    jscad.primitives.cuboid({ size: [20, 12, 3] }),
    ...[-5, 5].map((x) =>
      jscad.primitives.cylinder({
        radius: 2,
        height: 6,
        center: [x, 0, 0],
        segments: 16,
      }),
    ),
  )
  const transformed = jscad.transforms.translate(
    [30, -10, 5],
    jscad.transforms.rotateZ(0.37, plate),
  )
  const merged = jscadToStep({ geometries: [{ geom: transformed }] })
  const original = jscadToStep(
    { geometries: [{ geom: transformed }] },
    { mergeCoplanarFaces: false },
  )
  expect(inspectFaces(merged).horizontal.map((f) => f.bounds.length)).toEqual([
    3, 3,
  ])
  expectClosedTopology(merged)
  const { default: createOcct } = await import("occt-import-js")
  const occt = await createOcct()
  const read = (step: string) =>
    occt.ReadStepFile(new TextEncoder().encode(step), null)
  const oldMesh = read(original)
  const newMesh = read(merged)
  expect(oldMesh.success).toBe(true)
  expect(newMesh.success).toBe(true)
  function measures(result: any) {
    let volume = 0,
      area = 0
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity]
    for (const mesh of result.meshes) {
      const p = mesh.attributes.position.array
      for (let i = 0; i < p.length; i++) {
        const axis = i % 3
        min[axis] = Math.min(min[axis]!, p[i])
        max[axis] = Math.max(max[axis]!, p[i])
      }
      const indices = mesh.index.array
      for (let i = 0; i < indices.length; i += 3) {
        const [a, b, c] = indices
          .slice(i, i + 3)
          .map((id: number) => p.slice(id * 3, id * 3 + 3))
        const ab = b.map((v: number, j: number) => v - a[j]),
          ac = c.map((v: number, j: number) => v - a[j])
        const cross = [
          ab[1] * ac[2] - ab[2] * ac[1],
          ab[2] * ac[0] - ab[0] * ac[2],
          ab[0] * ac[1] - ab[1] * ac[0],
        ]
        area += Math.hypot(...cross) / 2
        volume +=
          (a[0] * (b[1] * c[2] - b[2] * c[1])) / 6 +
          (a[1] * (b[2] * c[0] - b[0] * c[2])) / 6 +
          (a[2] * (b[0] * c[1] - b[1] * c[0])) / 6
      }
    }
    return { min, max, area, volume }
  }
  const old = measures(oldMesh),
    current = measures(newMesh)
  for (let axis = 0; axis < 3; axis++) {
    expect(current.min[axis]).toBeCloseTo(old.min[axis]!, 5)
    expect(current.max[axis]).toBeCloseTo(old.max[axis]!, 5)
  }
  expect(current.area).toBeCloseTo(old.area, 3)
  expect(current.volume).toBeCloseTo(old.volume, 3)
  await expect(merged).toMatchStepSnapshot(import.meta.path, "coplanar-holes")
}, 30_000)

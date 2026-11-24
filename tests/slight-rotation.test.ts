import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { jscadToStep } from "../lib"

test("slightly rotated geometry remains readable with scientific notation", async () => {
  const geom = jscad.transforms.rotateZ(
    1e-7,
    jscad.primitives.cube({ size: 10 }),
  )
  const stepData = jscadToStep({ geometries: [{ geom }] })

  expect(stepData).not.toMatch(/\d(?:\.\d+)?e[+-]\d+/)

  const { default: createOcct } = await import("occt-import-js")
  const occt = await createOcct()
  const result = occt.ReadStepFile(new TextEncoder().encode(stepData), null)

  expect(result.success).toBe(true)
  expect(result.meshes).toHaveLength(1)
  expect(result.meshes[0]!.attributes.position.array).toHaveLength(72)

  await expect(stepData).toMatchStepSnapshot(
    import.meta.path,
    "slight-rotation",
  )
}, 30_000)

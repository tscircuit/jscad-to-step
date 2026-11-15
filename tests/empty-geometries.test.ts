import { expect, test } from "bun:test"
import { jscadToStep } from "../lib"

const triangleGeom = {
  polygons: [
    {
      vertices: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
      ],
    },
  ],
}

test("empty rendered geometries emit STEP instead of throwing", () => {
  const stepData = jscadToStep({ geometries: [] } as any)

  expect(stepData).toContain("ISO-10303-21")
  expect(stepData).not.toContain("MANIFOLD_SOLID_BREP")
})

test("empty geom3 siblings are skipped instead of throwing", () => {
  const stepData = jscadToStep({
    geometries: [{ geom: { polygons: [] } }, { geom: triangleGeom }],
  } as any)

  expect(stepData).toContain("ISO-10303-21")
  expect(stepData).toContain("MANIFOLD_SOLID_BREP")
})

test("geom2 siblings without polygons do not abort later geom3 solids", () => {
  const stepData = jscadToStep({
    geometries: [
      {
        geom: {
          sides: [
            [
              [0, 0],
              [1, 0],
            ],
          ],
        },
      },
      { geom: triangleGeom },
    ],
  } as any)

  expect(stepData).toContain("ISO-10303-21")
  expect(stepData).toContain("MANIFOLD_SOLID_BREP")
})

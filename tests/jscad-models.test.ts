import { expect, test } from "bun:test"
import * as jscad from "@jscad/modeling"
import { getJscadModelForFootprint } from "jscad-electronics/vanilla"
import { convertColorInputToStepColor } from "../lib/colors/index.ts"
import { jscadToStep } from "../lib"

const FOOTPRINTS = ["0402", "dip8", "dfn8", "sot223"] as const

for (const footprint of FOOTPRINTS) {
  test(`${footprint} renders correctly`, async () => {
    const model = getJscadModelForFootprint(footprint, jscad as any)
    const expectedStyledItems = model.geometries.filter((entry) =>
      convertColorInputToStepColor(entry.color ?? entry.geom.color),
    ).length

    const stepData = jscadToStep(model as any)

    expect((stepData.match(/STYLED_ITEM/g) ?? []).length).toBe(
      expectedStyledItems,
    )

    await expect(stepData).toMatchStepSnapshot(import.meta.path, footprint)
  }, 30000)
}

import { test, expect } from "bun:test"
import * as jscad from "@jscad/modeling"
import { getJscadModelForFootprint } from "jscad-electronics/vanilla"
import { jscadToStep } from "../lib"

test("soic8 renders correctly", async () => {
  const model = getJscadModelForFootprint("soic8", jscad as any)

  const stepData = jscadToStep(model as any)

  await expect(stepData).toMatchStepSnapshot(import.meta.path, "soic8")
}, 30000)

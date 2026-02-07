import { test, expect } from "bun:test"
import { jscadPlanner } from "jscad-planner"
import { jscadToStep } from "../lib"

test("cuboid renders correctly", async () => {
  const cuboid = jscadPlanner.primitives.cuboid({ size: [10, 5, 3] })
  const stepData = jscadToStep(cuboid)
  await expect(stepData).toMatchStepSnapshot(import.meta.path, "cuboid")
}, 30000)

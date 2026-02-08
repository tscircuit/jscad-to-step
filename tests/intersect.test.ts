import { test, expect } from "bun:test"
import { jscadPlanner } from "jscad-planner"
import { jscadToStep } from "../lib"

test("intersect renders correctly", async () => {
  const cube = jscadPlanner.primitives.cube({ size: 10 })
  const sphere = jscadPlanner.primitives.sphere({ radius: 7, resolution: 16 })
  const result = jscadPlanner.booleans.intersect(cube, sphere)
  const stepData = jscadToStep(result)
  await expect(stepData).toMatchStepSnapshot(import.meta.path, "intersect")
}, 30000)

import { test, expect } from "bun:test"
import { jscadPlanner } from "jscad-planner"
import { jscadToStep } from "../lib"

test("subtract renders correctly", async () => {
  const cube = jscadPlanner.primitives.cube({ size: 10 })
  const sphere = jscadPlanner.primitives.sphere({ radius: 7, segments: 16 })
  const result = jscadPlanner.booleans.subtract(cube, sphere)
  const stepData = jscadToStep(result)
  await expect(stepData).toMatchStepSnapshot(import.meta.path, "subtract")
}, 30000)

import { test, expect } from "bun:test"
import { jscadPlanner } from "jscad-planner"
import { jscadToStep } from "../lib"

test("colorize renders correctly", async () => {
  const cube = jscadPlanner.primitives.cube({ size: 10 })
  const red = jscadPlanner.colors.colorize([1, 0, 0], cube)
  const stepData = jscadToStep(red)
  await expect(stepData).toMatchStepSnapshot(import.meta.path, "colorize")
}, 30000)

import { test, expect } from "bun:test"
import { jscadPlanner } from "jscad-planner"
import { jscadToStep } from "../lib"

test("translate renders correctly", async () => {
  const cube = jscadPlanner.primitives.cube({ size: 10 })
  const translated = jscadPlanner.transforms.translate([5, 5, 5], cube)
  const stepData = jscadToStep(translated)
  await expect(stepData).toMatchStepSnapshot(import.meta.path, "translate")
}, 30000)

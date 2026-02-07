import { test, expect } from "bun:test"
import { jscadPlanner } from "jscad-planner"
import { jscadToStep } from "../lib"

test("union renders correctly", async () => {
  const cube = jscadPlanner.primitives.cube({ size: 10 })
  const sphere = jscadPlanner.primitives.sphere({ radius: 5, resolution: 16 })
  const translated = jscadPlanner.transforms.translate([5, 5, 5], sphere)
  const result = jscadPlanner.booleans.union(cube, translated)
  const stepData = jscadToStep(result)
  await expect(stepData).toMatchStepSnapshot(import.meta.path, "union")
}, 30000)

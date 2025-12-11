import { test, expect } from "bun:test"
import { jscadPlanner } from "jscad-planner"
import { jscadToStep } from "../lib"

test("cube renders correctly", async () => {
  // Create a cube using jscad-planner
  const cube = jscadPlanner.primitives.cube({ size: 10 })

  // Convert jscad operation to STEP format
  const stepData = jscadToStep(cube)

  // Render STEP to PNG and compare with snapshot
  await expect(stepData).toMatchStepSnapshot(import.meta.path, "cube")
}, 30000)

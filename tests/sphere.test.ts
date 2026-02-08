import { test, expect } from "bun:test"
import { jscadPlanner } from "jscad-planner"
import { jscadToStep } from "../lib"

test("sphere renders correctly", async () => {
  const sphere = jscadPlanner.primitives.sphere({ radius: 5, resolution: 16 })
  const stepData = jscadToStep(sphere)
  await expect(stepData).toMatchStepSnapshot(import.meta.path, "sphere")
}, 30000)

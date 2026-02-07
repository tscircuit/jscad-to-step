import { test, expect } from "bun:test"
import { jscadPlanner } from "jscad-planner"
import { jscadToStep } from "../lib"

test("cylinder renders correctly", async () => {
  const cylinder = jscadPlanner.primitives.cylinder({
    radius: 5,
    height: 10,
  })
  const stepData = jscadToStep(cylinder)
  await expect(stepData).toMatchStepSnapshot(import.meta.path, "cylinder")
}, 30000)

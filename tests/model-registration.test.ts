import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { getJscadModelForFootprint } from "jscad-electronics/vanilla"
import { jscadPlanner } from "jscad-planner"
import { parseRepository } from "stepts"
import { jscadToStep } from "../lib"

const models = [
  "hexbolt_m3_l8mm_nothreads",
  "hexsocketbolt_m3_l6mm_nothreads",
  "sheetmetal_plate_w24mm_l20mm_t1mm",
  "nema17_l39mm",
  "helicalgear6_m1mm_w1mm_ha0deg_right_segments4_turnsegments12",
  "spurgear6_m1mm_w1mm_segments4",
  "wormgear_m1mm_d3mm_l1mm_starts1_segments24_turnsegments12",
  "flexscreen30_w16_h10_flex10_p0.5mm_tail2mm_taper3mm_sitsflat",
] as const

test("registered models stay synchronous and representative families export equivalent STEP", () => {
  for (const modelString of models) {
    const evaluated = getJscadModelForFootprint(modelString, jscad)
    const planned = getJscadModelForFootprint(
      modelString,
      jscadPlanner as unknown as typeof jscad,
    )
    const before = structuredClone(evaluated)
    expect(evaluated).not.toBeInstanceOf(Promise)
    expect(evaluated.geometries.length).toBeGreaterThan(0)
    expect(planned.geometries.length).toBe(evaluated.geometries.length)
    // Cover the complete exporter path without adding minutes of dense bolt,
    // motor, and display triangulation to the existing visual test suite.
    if (/^(hexbolt|nema|flexscreen)/.test(modelString)) {
      expect(evaluated).toEqual(before)
      continue
    }
    const step = jscadToStep(
      evaluated as unknown as Parameters<typeof jscadToStep>[0],
    )
    const plannedStep = jscadToStep(
      planned as unknown as Parameters<typeof jscadToStep>[0],
    )
    expect(step).toBe(plannedStep)
    expect(step).toStartWith("ISO-10303-21;")
    const nonempty = evaluated.geometries.filter(
      ({ geom }) => geom.polygons.length > 0,
    )
    expect(nonempty.length).toBeGreaterThan(0)
    expect((step.match(/MANIFOLD_SOLID_BREP\(/g) ?? []).length).toBe(
      nonempty.length,
    )
    expect((step.match(/CLOSED_SHELL\(/g) ?? []).length).toBe(nonempty.length)
    const repository = parseRepository(step)
    expect(repository.entries().length).toBeGreaterThan(nonempty.length)
    expect(repository.toPartFile({ name: "round-trip.step" })).toContain(
      "MANIFOLD_SOLID_BREP",
    )
    expect(evaluated).toEqual(before)
  }
  expect(() => getJscadModelForFootprint("hexbolt_m3_l0mm", jscad)).toThrow()
}, 30_000)

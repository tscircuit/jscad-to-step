# jscad-to-step

Convert [jscad-planner](https://github.com/tscircuit/jscad-planner) operations to STEP files.

## Installation

```bash
npm install jscad-to-step
```

## Usage

```ts
import { jscadPlanner } from "jscad-planner"
import { jscadToStep } from "jscad-to-step"
import fs from "fs"

// Primitives
const cube = jscadPlanner.primitives.cube({ size: 10 })
fs.writeFileSync("cube.step", jscadToStep(cube))

const sphere = jscadPlanner.primitives.sphere({ radius: 5, resolution: 16 })
fs.writeFileSync("sphere.step", jscadToStep(sphere))

const cylinder = jscadPlanner.primitives.cylinder({ radius: 5, height: 10 })
fs.writeFileSync("cylinder.step", jscadToStep(cylinder))

const cuboid = jscadPlanner.primitives.cuboid({ size: [10, 5, 3] })
fs.writeFileSync("cuboid.step", jscadToStep(cuboid))

// Transforms
const translated = jscadPlanner.transforms.translate([5, 5, 5], cube)
fs.writeFileSync("translated.step", jscadToStep(translated))

// Colors
const red = jscadPlanner.colors.colorize([1, 0, 0], cube)
fs.writeFileSync("red-cube.step", jscadToStep(red))

// Boolean operations
const union = jscadPlanner.booleans.union(cube, sphere)
fs.writeFileSync("union.step", jscadToStep(union))

const subtracted = jscadPlanner.booleans.subtract(cube, sphere)
fs.writeFileSync("subtract.step", jscadToStep(subtracted))

const intersected = jscadPlanner.booleans.intersect(cube, sphere)
fs.writeFileSync("intersect.step", jscadToStep(intersected))
```

`jscadToStep()` also accepts pre-rendered models with the shape `{ geometries: [{ geom, color }] }`.

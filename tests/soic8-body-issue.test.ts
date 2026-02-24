import { test, expect } from "bun:test"
import * as jscad from "@jscad/modeling"
import { getJscadModelForFootprint } from "jscad-electronics/vanilla"
import { jscadToStep } from "../lib"
import {
  renderDrawCalls,
  type DrawCall,
  encodePNGToBuffer,
  pureImageFactory,
} from "poppygl"
import { mat4 } from "gl-matrix"

async function loadOcct() {
  const imported = (await import("occt-import-js")) as any
  const factory = typeof imported === "function" ? imported : imported.default
  return factory()
}

function meshToDrawCall(mesh: any): DrawCall {
  const positions = new Float32Array(mesh.attributes.position.array)
  const indices = new Uint32Array(mesh.index.array)
  let normals: Float32Array | null = null
  if (mesh.attributes.normal) {
    normals = new Float32Array(mesh.attributes.normal.array)
  }
  const model = mat4.create()
  return {
    positions,
    indices,
    normals,
    uvs: null,
    model,
    material: {
      baseColorFactor: mesh.color
        ? ([mesh.color[0], mesh.color[1], mesh.color[2], 1.0] as [
            number,
            number,
            number,
            number,
          ])
        : [0.8, 0.8, 0.8, 1.0],
      baseColorTexture: null,
    },
  }
}

test("soic8 body has no holes or empty spaces", async () => {
  const model = getJscadModelForFootprint("soic8", jscad as any)
  const stepData = jscadToStep(model as any)

  const occt = await loadOcct()
  const data = new TextEncoder().encode(stepData)
  const result = occt.ReadStepFile(data, null)

  const drawCalls = result.meshes.map(meshToDrawCall)

  const renderResult = renderDrawCalls(
    drawCalls,
    {
      width: 512,
      height: 512,
      backgroundColor: "#ff0000",
      camPos: [0, 18, 18],
      lookAt: [0, 0, 0],
    },
    pureImageFactory,
  )

  const pngBuffer = await encodePNGToBuffer(renderResult.bitmap)
  await expect(pngBuffer).toMatchPngSnapshot(
    import.meta.path,
    "soic8-body-issue",
  )
}, 30000)

import { expect, type MatcherResult } from "bun:test"
import { renderDrawCalls, type DrawCall } from "poppygl"
import { mat4 } from "gl-matrix"
import { encodePNGToBuffer, pureImageFactory } from "poppygl"

// Lazy-loaded OCCT instance
let occtInstancePromise: Promise<any> | undefined

async function loadOcct() {
  if (!occtInstancePromise) {
    const imported = (await import("occt-import-js")) as any
    const factory = typeof imported === "function" ? imported : imported.default
    occtInstancePromise = factory()
  }
  return occtInstancePromise
}

/**
 * Convert occt-import-js mesh to poppygl DrawCall
 */
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

/**
 * Render STEP data to a PNG buffer using occt-import-js + poppygl
 */
async function renderStepToPng(
  stepData: Buffer | Uint8Array | string,
): Promise<Buffer> {
  const occt = await loadOcct()

  // Convert to Uint8Array if needed
  let data: Uint8Array
  if (typeof stepData === "string") {
    data = new TextEncoder().encode(stepData)
  } else if (stepData instanceof Buffer) {
    data = new Uint8Array(stepData)
  } else {
    data = stepData
  }

  const result = occt.ReadStepFile(data, null)
  if (!result.success) {
    throw new Error("occt-import-js failed to load STEP file")
  }

  // Convert meshes to DrawCalls
  const drawCalls: DrawCall[] = result.meshes.map((mesh: any) =>
    meshToDrawCall(mesh),
  )

  // Use poppygl to render the DrawCalls to PNG
  const renderResult = renderDrawCalls(
    drawCalls,
    {
      width: 256,
      height: 256,
      backgroundColor: "#f0f0f0",
    },
    pureImageFactory,
  )

  const pngBuffer = encodePNGToBuffer(renderResult.bitmap)
  return pngBuffer
}

/**
 * Matcher for STEP snapshot testing.
 * Renders STEP data to PNG and delegates to PNG matcher.
 */
async function toMatchStepSnapshot(
  this: any,
  receivedMaybePromise:
    | Buffer
    | Uint8Array
    | string
    | Promise<Buffer | Uint8Array | string>,
  testPath: string,
  snapshotName?: string,
): Promise<MatcherResult> {
  const received = await receivedMaybePromise

  // Render STEP to PNG
  const pngBuffer = await renderStepToPng(received)

  // Delegate to PNG matcher (reuse from png-matcher)
  return await (expect(pngBuffer) as any).toMatchPngSnapshot(
    testPath,
    snapshotName,
  )
}

// Register the matcher globally
expect.extend({
  toMatchStepSnapshot: toMatchStepSnapshot as any,
})

declare module "bun:test" {
  interface Matchers<T = unknown> {
    toMatchStepSnapshot(
      testPath: string,
      snapshotName?: string,
    ): Promise<MatcherResult>
  }
}

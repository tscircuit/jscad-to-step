export type Vec3 = [number, number, number]

export const subtract = (a: Vec3, b: Vec3): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
]

export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

export const normalize = (v: Vec3): Vec3 => {
  const length = Math.hypot(v[0], v[1], v[2])
  if (!length) return [0, 0, 1]
  return [v[0] / length, v[1] / length, v[2] / length]
}

export const applyTransform = (vector: Vec3, matrix?: number[]): Vec3 => {
  if (!Array.isArray(matrix) || matrix.length !== 16) return vector
  const m = matrix
  const [x, y, z] = vector
  const nx = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!
  const ny = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!
  const nz = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!
  const w = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!
  if (w && w !== 1) {
    return [nx / w, ny / w, nz / w]
  }
  return [nx, ny, nz]
}

export const vertexKey = (v: Vec3): string =>
  `${v[0].toFixed(7)},${v[1].toFixed(7)},${v[2].toFixed(7)}`

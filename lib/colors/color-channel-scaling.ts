export type StepColor = [number, number, number]

export function clampChannel(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function scaleRgbChannels(
  channels: number[],
  scale: number,
): StepColor | undefined {
  if (channels.length < 3) return undefined
  if (channels.some((channel) => !Number.isFinite(channel))) return undefined

  return [
    clampChannel(channels[0]! / scale),
    clampChannel(channels[1]! / scale),
    clampChannel(channels[2]! / scale),
  ]
}

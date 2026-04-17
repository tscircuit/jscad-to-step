import { scaleRgbChannels } from "./color-channel-scaling.ts"
import type { StepColor } from "./color-channel-scaling.ts"

export type StepColorInput = number[] | string

function convertRgbArrayToStepColor(color: number[]): StepColor | undefined {
  if (color.length < 3) return undefined

  const rgb = color.slice(0, 3).map((channel) => Number(channel))
  const usesByteRange = rgb.some((channel) => channel > 1)
  const scale = usesByteRange ? 255 : 1

  return scaleRgbChannels(rgb, scale)
}

function convertHexColorToStepColor(color: string): StepColor | undefined {
  const hex = color.trim().replace(/^#/, "")

  if (hex.length === 3 || hex.length === 4) {
    const expanded = hex
      .slice(0, 3)
      .split("")
      .map((channel) => channel + channel)
      .join("")
    return convertHexColorToStepColor(expanded)
  }

  if (hex.length !== 6 && hex.length !== 8) return undefined

  const rgbHex = hex.slice(0, 6)
  if (!/^[\da-fA-F]{6}$/.test(rgbHex)) return undefined

  const channels = [
    parseInt(rgbHex.slice(0, 2), 16),
    parseInt(rgbHex.slice(2, 4), 16),
    parseInt(rgbHex.slice(4, 6), 16),
  ]

  return scaleRgbChannels(channels, 255)
}

function convertFunctionalColorToStepColor(
  color: string,
): StepColor | undefined {
  const match = color.trim().match(/^rgba?\(\s*([^)]+)\s*\)$/i)
  if (!match) return undefined

  const rawChannels = match[1]!
    .split(",")
    .map((part) => part.trim())
    .slice(0, 3)

  const channels = rawChannels.map((part) => Number(part.replace(/%$/, "")))
  const usesPercent = rawChannels.some((part) => part.endsWith("%"))
  const scale = usesPercent ? 100 : 255

  return scaleRgbChannels(channels, scale)
}

function convertCssColorToStepColor(color: string): StepColor | undefined {
  const bun = (
    globalThis as {
      Bun?: { color?: (input: string, outputFormat: string) => string | null }
    }
  ).Bun
  if (typeof bun?.color !== "function") return undefined

  const hex = bun.color(color, "hex")
  if (!hex) return undefined

  return convertHexColorToStepColor(hex)
}

export function convertColorInputToStepColor(
  color: StepColorInput | undefined,
): StepColor | undefined {
  if (!color) return undefined
  if (Array.isArray(color)) return convertRgbArrayToStepColor(color)
  if (typeof color !== "string") return undefined

  return (
    convertHexColorToStepColor(color) ??
    convertFunctionalColorToStepColor(color) ??
    convertCssColorToStepColor(color)
  )
}

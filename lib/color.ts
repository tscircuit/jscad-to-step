import {
  ColourRgb,
  FillAreaStyle,
  FillAreaStyleColour,
  PresentationStyleAssignment,
  type Ref,
  type Repository,
  StyledItem,
  SurfaceSideStyle,
  SurfaceStyleFillArea,
  SurfaceStyleUsage,
  type Entity,
} from "stepts"

/**
 * Build the STEP color chain and return a StyledItem ref.
 * Chain: ColourRgb → FillAreaStyleColour → FillAreaStyle → SurfaceStyleFillArea
 *        → SurfaceSideStyle → SurfaceStyleUsage → PresentationStyleAssignment → StyledItem
 */
export function applyColorChain(
  repo: Repository,
  item: Ref<Entity>,
  color: number[],
): Ref<StyledItem> {
  const r = color[0] ?? 0.8
  const g = color[1] ?? 0.8
  const b = color[2] ?? 0.8

  const colourRgb = repo.add(new ColourRgb("", r, g, b))
  const fillColour = repo.add(new FillAreaStyleColour("", colourRgb))
  const fillStyle = repo.add(new FillAreaStyle("", [fillColour]))
  const surfaceFill = repo.add(new SurfaceStyleFillArea(fillStyle))
  const sideStyle = repo.add(new SurfaceSideStyle("", [surfaceFill]))
  const styleUsage = repo.add(new SurfaceStyleUsage(".BOTH.", sideStyle))
  const presentationStyle = repo.add(
    new PresentationStyleAssignment([styleUsage]),
  )
  return repo.add(new StyledItem("", [presentationStyle], item))
}

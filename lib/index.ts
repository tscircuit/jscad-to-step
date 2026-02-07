import jscad from "@jscad/modeling"
import type { JscadOperation } from "jscad-planner"
import { executeJscadOperations } from "jscad-planner"
import {
  AdvancedBrepShapeRepresentation,
  ApplicationContext,
  ApplicationProtocolDefinition,
  Axis2Placement3D,
  CartesianPoint,
  ClosedShell,
  Direction,
  ManifoldSolidBrep,
  ProductContext,
  Product,
  ProductDefinition,
  ProductDefinitionContext,
  ProductDefinitionFormation,
  ProductDefinitionShape,
  type Ref,
  Repository,
  ShapeDefinitionRepresentation,
  Unknown,
} from "stepts"
import { geom3ToBrep } from "./geom3-to-brep.ts"
import { applyColorChain } from "./color.ts"

interface Geom3Like {
  polygons: Array<{ vertices: any[] }>
  transforms?: number[]
  color?: number[]
}

interface RenderedModel {
  geometries: Array<{ geom: Geom3Like; color?: number[] }>
}

function isRenderedModel(input: any): input is RenderedModel {
  return (
    input &&
    typeof input === "object" &&
    Array.isArray(input.geometries) &&
    input.geometries.length > 0 &&
    input.geometries[0]?.geom?.polygons
  )
}

function resolveGeometries(input: JscadOperation | RenderedModel): Geom3Like[] {
  if (isRenderedModel(input)) {
    return input.geometries.map((entry) => {
      const geom = entry.geom
      if (entry.color && Array.isArray(entry.color) && !geom.color) {
        return { ...geom, color: entry.color }
      }
      return geom
    })
  }

  const result = executeJscadOperations(jscad as any, input) as
    | Geom3Like
    | Geom3Like[]

  return Array.isArray(result) ? result : [result]
}

export function jscadToStep(operation: JscadOperation): string {
  const repo = new Repository()

  const geometries = resolveGeometries(operation)

  // Product structure
  const appContext = repo.add(
    new ApplicationContext(
      "core data for automotive mechanical design processes",
    ),
  )
  repo.add(
    new ApplicationProtocolDefinition(
      "international standard",
      "automotive_design",
      2000,
      appContext,
    ),
  )
  const productContext = repo.add(
    new ProductContext("", appContext, "mechanical"),
  )
  const product = repo.add(new Product("shape", "shape", "", [productContext]))
  const productDefContext = repo.add(
    new ProductDefinitionContext("part definition", appContext, "design"),
  )
  const productDefFormation = repo.add(
    new ProductDefinitionFormation("", "", product),
  )
  const productDef = repo.add(
    new ProductDefinition(
      "design",
      "",
      productDefFormation,
      productDefContext,
    ),
  )
  const productDefShape = repo.add(
    new ProductDefinitionShape("", "", productDef),
  )

  // Units context
  const lengthUnit = repo.add(
    new Unknown("", [
      "( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) )",
    ]),
  )
  const angleUnit = repo.add(
    new Unknown("", [
      "( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) )",
    ]),
  )
  const solidAngleUnit = repo.add(
    new Unknown("", [
      "( NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT() )",
    ]),
  )
  const uncertainty = repo.add(
    new Unknown("UNCERTAINTY_MEASURE_WITH_UNIT", [
      "LENGTH_MEASURE(1.E-07)",
      `${lengthUnit}`,
      "'distance_accuracy_value'",
      "'confusion accuracy'",
    ]),
  )
  const geomContext = repo.add(
    new Unknown("", [
      `( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((${uncertainty})) GLOBAL_UNIT_ASSIGNED_CONTEXT((${lengthUnit},${angleUnit},${solidAngleUnit})) REPRESENTATION_CONTEXT('Context #1','3D Context with TORTURE://UNITS') )`,
    ]),
  )

  const origin = repo.add(new CartesianPoint("", 0, 0, 0))
  const zDir = repo.add(new Direction("", 0, 0, 1))
  const xDir = repo.add(new Direction("", 1, 0, 0))
  const placement = repo.add(new Axis2Placement3D("", origin, zDir, xDir))

  const shapeItems: Ref<any>[] = [placement]
  const colorItems: Ref<any>[] = []

  for (const geom of geometries) {
    if (!geom?.polygons || geom.polygons.length === 0) continue

    const faces = geom3ToBrep(repo, geom)
    if (faces.length === 0) continue

    const shell = repo.add(new ClosedShell("", faces))
    const solid = repo.add(new ManifoldSolidBrep("", shell))
    shapeItems.push(solid)

    // Apply color if present
    if (geom.color && Array.isArray(geom.color) && geom.color.length >= 3) {
      const styledItem = applyColorChain(repo, solid, geom.color)
      colorItems.push(styledItem)
    }
  }

  const shapeRep = repo.add(
    new AdvancedBrepShapeRepresentation("", shapeItems, geomContext),
  )
  repo.add(new ShapeDefinitionRepresentation(productDefShape, shapeRep))

  // If we have colored items, add MechanicalDesignGeometricPresentationRepresentation
  if (colorItems.length > 0) {
    repo.add(
      new Unknown("MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION", [
        "''",
        `(${colorItems.join(",")})`,
        `${geomContext}`,
      ]),
    )
  }

  return repo.toPartFile({ name: "shape.step" })
}

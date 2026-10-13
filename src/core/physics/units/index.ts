/** Seven SI base dimensions in the canonical order used by this module. */
export type DimensionVector = readonly [
  mass: number,
  length: number,
  time: number,
  electricCurrent: number,
  temperature: number,
  amount: number,
  luminousIntensity: number,
];

function freezeDimension<T extends DimensionVector>(dimension: T): T {
  return Object.freeze(dimension) as T;
}

export const DIMENSIONS = Object.freeze({
  dimensionless: freezeDimension([0, 0, 0, 0, 0, 0, 0] as const),
  mass: freezeDimension([1, 0, 0, 0, 0, 0, 0] as const),
  length: freezeDimension([0, 1, 0, 0, 0, 0, 0] as const),
  time: freezeDimension([0, 0, 1, 0, 0, 0, 0] as const),
  velocity: freezeDimension([0, 1, -1, 0, 0, 0, 0] as const),
  acceleration: freezeDimension([0, 1, -2, 0, 0, 0, 0] as const),
  force: freezeDimension([1, 1, -2, 0, 0, 0, 0] as const),
  energy: freezeDimension([1, 2, -2, 0, 0, 0, 0] as const),
  power: freezeDimension([1, 2, -3, 0, 0, 0, 0] as const),
  springConstant: freezeDimension([1, 0, -2, 0, 0, 0, 0] as const),
  dampingCoefficient: freezeDimension([1, 0, -1, 0, 0, 0, 0] as const),
  frequency: freezeDimension([0, 0, -1, 0, 0, 0, 0] as const),
  area: freezeDimension([0, 2, 0, 0, 0, 0, 0] as const),
  volume: freezeDimension([0, 3, 0, 0, 0, 0, 0] as const),
  pressure: freezeDimension([1, -1, -2, 0, 0, 0, 0] as const),
  temperature: freezeDimension([0, 0, 0, 0, 1, 0, 0] as const),
  current: freezeDimension([0, 0, 0, 1, 0, 0, 0] as const),
  amount: freezeDimension([0, 0, 0, 0, 0, 1, 0] as const),
  luminousIntensity: freezeDimension([0, 0, 0, 0, 0, 0, 1] as const),
  angle: freezeDimension([0, 0, 0, 0, 0, 0, 0] as const),
} as const satisfies Record<string, DimensionVector>);

export type NamedDimension = keyof typeof DIMENSIONS;
export type DimensionLabel = NamedDimension | "derived";

type UnitDefinition = {
  kind: NamedDimension;
  dimension: DimensionVector;
  scale: number;
  offset: number;
};

function defineUnit<const T extends UnitDefinition>(definition: T): Readonly<T> {
  return Object.freeze(definition);
}

export type Quantity<D extends DimensionLabel = DimensionLabel> = Readonly<{
  /** Canonical SI value, including any unit offset such as Celsius. */
  value: number;
  /** Runtime exponents allow dimensional checks for derived operations. */
  dimension: DimensionVector;
  /** A descriptive compile-time/runtime hint; dimensions are authoritative. */
  kind: D;
}>;

export const UNIT_DEFINITIONS = Object.freeze({
  "1": defineUnit({ kind: "dimensionless", dimension: DIMENSIONS.dimensionless, scale: 1, offset: 0 }),
  kg: defineUnit({ kind: "mass", dimension: DIMENSIONS.mass, scale: 1, offset: 0 }),
  g: defineUnit({ kind: "mass", dimension: DIMENSIONS.mass, scale: 1e-3, offset: 0 }),
  m: defineUnit({ kind: "length", dimension: DIMENSIONS.length, scale: 1, offset: 0 }),
  km: defineUnit({ kind: "length", dimension: DIMENSIONS.length, scale: 1e3, offset: 0 }),
  cm: defineUnit({ kind: "length", dimension: DIMENSIONS.length, scale: 1e-2, offset: 0 }),
  mm: defineUnit({ kind: "length", dimension: DIMENSIONS.length, scale: 1e-3, offset: 0 }),
  s: defineUnit({ kind: "time", dimension: DIMENSIONS.time, scale: 1, offset: 0 }),
  ms: defineUnit({ kind: "time", dimension: DIMENSIONS.time, scale: 1e-3, offset: 0 }),
  min: defineUnit({ kind: "time", dimension: DIMENSIONS.time, scale: 60, offset: 0 }),
  h: defineUnit({ kind: "time", dimension: DIMENSIONS.time, scale: 3600, offset: 0 }),
  "m/s": defineUnit({ kind: "velocity", dimension: DIMENSIONS.velocity, scale: 1, offset: 0 }),
  "km/h": defineUnit({ kind: "velocity", dimension: DIMENSIONS.velocity, scale: 1 / 3.6, offset: 0 }),
  "m/s²": defineUnit({ kind: "acceleration", dimension: DIMENSIONS.acceleration, scale: 1, offset: 0 }),
  N: defineUnit({ kind: "force", dimension: DIMENSIONS.force, scale: 1, offset: 0 }),
  kN: defineUnit({ kind: "force", dimension: DIMENSIONS.force, scale: 1e3, offset: 0 }),
  J: defineUnit({ kind: "energy", dimension: DIMENSIONS.energy, scale: 1, offset: 0 }),
  kJ: defineUnit({ kind: "energy", dimension: DIMENSIONS.energy, scale: 1e3, offset: 0 }),
  W: defineUnit({ kind: "power", dimension: DIMENSIONS.power, scale: 1, offset: 0 }),
  Hz: defineUnit({ kind: "frequency", dimension: DIMENSIONS.frequency, scale: 1, offset: 0 }),
  "kg/s": defineUnit({ kind: "dampingCoefficient", dimension: DIMENSIONS.dampingCoefficient, scale: 1, offset: 0 }),
  "N/m": defineUnit({ kind: "springConstant", dimension: DIMENSIONS.springConstant, scale: 1, offset: 0 }),
  Pa: defineUnit({ kind: "pressure", dimension: DIMENSIONS.pressure, scale: 1, offset: 0 }),
  "m²": defineUnit({ kind: "area", dimension: DIMENSIONS.area, scale: 1, offset: 0 }),
  "m³": defineUnit({ kind: "volume", dimension: DIMENSIONS.volume, scale: 1, offset: 0 }),
  K: defineUnit({ kind: "temperature", dimension: DIMENSIONS.temperature, scale: 1, offset: 0 }),
  "°C": defineUnit({ kind: "temperature", dimension: DIMENSIONS.temperature, scale: 1, offset: 273.15 }),
  A: defineUnit({ kind: "current", dimension: DIMENSIONS.current, scale: 1, offset: 0 }),
  mol: defineUnit({ kind: "amount", dimension: DIMENSIONS.amount, scale: 1, offset: 0 }),
  cd: defineUnit({ kind: "luminousIntensity", dimension: DIMENSIONS.luminousIntensity, scale: 1, offset: 0 }),
  rad: defineUnit({ kind: "angle", dimension: DIMENSIONS.angle, scale: 1, offset: 0 }),
  deg: defineUnit({ kind: "angle", dimension: DIMENSIONS.angle, scale: Math.PI / 180, offset: 0 }),
} satisfies Record<string, UnitDefinition>);

export type UnitSymbol = keyof typeof UNIT_DEFINITIONS;

export class DimensionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DimensionError";
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
}

function dimensionsEqual(left: DimensionVector, right: DimensionVector): boolean {
  return left.every((exponent, index) => exponent === right[index]);
}

export function quantity<U extends UnitSymbol>(value: number, unit: U): Quantity<(typeof UNIT_DEFINITIONS)[U]["kind"]> {
  assertFinite(value, "Quantity value");
  const definition = UNIT_DEFINITIONS[unit];
  const siValue = value * definition.scale + definition.offset;
  assertFinite(siValue, "Converted SI value");
  return Object.freeze({ value: siValue, dimension: definition.dimension, kind: definition.kind }) as Quantity<(typeof UNIT_DEFINITIONS)[U]["kind"]>;
}

export function fromSI<D extends NamedDimension>(value: number, kind: D): Quantity<D> {
  assertFinite(value, "Quantity value");
  return Object.freeze({ value, dimension: DIMENSIONS[kind], kind });
}

export function inUnit(value: Quantity, unit: UnitSymbol): number {
  const definition = UNIT_DEFINITIONS[unit];
  if (!dimensionsEqual(value.dimension, definition.dimension)) {
    throw new DimensionError(`Cannot convert ${value.kind} to ${unit}`);
  }
  const converted = (value.value - definition.offset) / definition.scale;
  assertFinite(converted, "Converted value");
  return converted;
}

function assertSameDimension(left: Quantity, right: Quantity, operation: string): void {
  if (!dimensionsEqual(left.dimension, right.dimension)) {
    throw new DimensionError(`Cannot ${operation} ${left.kind} and ${right.kind}`);
  }
}

export function add<D extends DimensionLabel>(left: Quantity<D>, right: Quantity<D>): Quantity<D> {
  assertSameDimension(left, right, "add");
  const result = left.value + right.value;
  assertFinite(result, "Sum");
  return Object.freeze({ ...left, value: result });
}

export function subtract<D extends DimensionLabel>(left: Quantity<D>, right: Quantity<D>): Quantity<D> {
  assertSameDimension(left, right, "subtract");
  const result = left.value - right.value;
  assertFinite(result, "Difference");
  return Object.freeze({ ...left, value: result });
}

export function scale<D extends DimensionLabel>(value: Quantity<D>, scalar: number): Quantity<D> {
  assertFinite(scalar, "Scale");
  const result = value.value * scalar;
  assertFinite(result, "Scaled quantity");
  return Object.freeze({ ...value, value: result });
}

export function multiply(left: Quantity, right: Quantity): Quantity {
  const dimension = Object.freeze(left.dimension.map((exponent, index) => exponent + right.dimension[index])) as unknown as DimensionVector;
  const value = left.value * right.value;
  assertFinite(value, "Product");
  return Object.freeze({ value, dimension, kind: identifyDimension(dimension) });
}

export function divide(left: Quantity, right: Quantity): Quantity {
  if (right.value === 0) throw new RangeError("Cannot divide a quantity by zero");
  const dimension = Object.freeze(left.dimension.map((exponent, index) => exponent - right.dimension[index])) as unknown as DimensionVector;
  const value = left.value / right.value;
  assertFinite(value, "Quotient");
  return Object.freeze({ value, dimension, kind: identifyDimension(dimension) });
}

export function power(value: Quantity, exponent: number): Quantity {
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 16) throw new RangeError("Dimension powers must be bounded integers");
  const result = value.value ** exponent;
  assertFinite(result, "Power");
  const dimension = Object.freeze(value.dimension.map(component => component * exponent)) as unknown as DimensionVector;
  return Object.freeze({ value: result, dimension, kind: identifyDimension(dimension) });
}

export function squareRoot(value: Quantity): Quantity {
  if (value.value < 0 || value.dimension.some(exponent => exponent % 2 !== 0)) {
    throw new DimensionError("Square root requires a nonnegative value and even dimension exponents");
  }
  const dimension = Object.freeze(value.dimension.map(exponent => exponent / 2)) as unknown as DimensionVector;
  return Object.freeze({ value: Math.sqrt(value.value), dimension, kind: identifyDimension(dimension) });
}

export function sine(value: Quantity): Quantity<"dimensionless"> {
  if (!dimensionsEqual(value.dimension, DIMENSIONS.dimensionless)) throw new DimensionError("Sine requires an angle or dimensionless quantity");
  return fromSI(Math.sin(value.value), "dimensionless");
}

export function cosine(value: Quantity): Quantity<"dimensionless"> {
  if (!dimensionsEqual(value.dimension, DIMENSIONS.dimensionless)) throw new DimensionError("Cosine requires an angle or dimensionless quantity");
  return fromSI(Math.cos(value.value), "dimensionless");
}

export function exponential(value: Quantity): Quantity<"dimensionless"> {
  if (!dimensionsEqual(value.dimension, DIMENSIONS.dimensionless)) throw new DimensionError("Exponential requires a dimensionless quantity");
  const result = Math.exp(value.value);
  assertFinite(result, "Exponential result");
  return fromSI(result, "dimensionless");
}

export function logarithm(value: Quantity): Quantity<"dimensionless"> {
  if (!dimensionsEqual(value.dimension, DIMENSIONS.dimensionless) || value.value <= 0) {
    throw new DimensionError("Logarithm requires a positive dimensionless quantity");
  }
  return fromSI(Math.log(value.value), "dimensionless");
}

function identifyDimension(dimension: DimensionVector): DimensionLabel {
  for (const [name, candidate] of Object.entries(DIMENSIONS) as [NamedDimension, DimensionVector][]) {
    if (dimensionsEqual(dimension, candidate)) return name;
  }
  return "derived";
}

function requireKind(value: Quantity, kind: NamedDimension): void {
  if (!dimensionsEqual(value.dimension, DIMENSIONS[kind])) {
    throw new DimensionError(`Expected ${kind}, received ${value.kind}`);
  }
}

export function forceFromMassAcceleration(mass: Quantity, acceleration: Quantity): Quantity<"force"> {
  requireKind(mass, "mass");
  requireKind(acceleration, "acceleration");
  const result = multiply(mass, acceleration);
  requireKind(result, "force");
  return fromSI(result.value, "force");
}

export function kineticEnergyFromMassVelocity(mass: Quantity, velocity: Quantity): Quantity<"energy"> {
  requireKind(mass, "mass");
  requireKind(velocity, "velocity");
  const result = scale(multiply(mass, power(velocity, 2)), 0.5);
  requireKind(result, "energy");
  return fromSI(result.value, "energy");
}

export function springPotentialEnergy(stiffness: Quantity, displacement: Quantity): Quantity<"energy"> {
  requireKind(stiffness, "springConstant");
  requireKind(displacement, "length");
  const result = scale(multiply(stiffness, power(displacement, 2)), 0.5);
  requireKind(result, "energy");
  return fromSI(result.value, "energy");
}

export function gravitationalPotentialEnergy(mass: Quantity, gravity: Quantity, height: Quantity): Quantity<"energy"> {
  requireKind(mass, "mass");
  requireKind(gravity, "acceleration");
  requireKind(height, "length");
  const result = multiply(multiply(mass, gravity), height);
  requireKind(result, "energy");
  return fromSI(result.value, "energy");
}

export function sameDimension(left: Quantity, right: Quantity): boolean {
  return dimensionsEqual(left.dimension, right.dimension);
}

import { describe, expect, expectTypeOf, it } from "vitest";
import {
  DimensionError,
  DIMENSIONS,
  UNIT_DEFINITIONS,
  add,
  cosine,
  divide,
  exponential,
  forceFromMassAcceleration,
  fromSI,
  gravitationalPotentialEnergy,
  inUnit,
  kineticEnergyFromMassVelocity,
  logarithm,
  multiply,
  power,
  quantity,
  sameDimension,
  sine,
  springPotentialEnergy,
  squareRoot,
  subtract,
  type Quantity,
} from "./index";

describe("SI quantities and dimensions", () => {
  it("converts common units to and from canonical SI values", () => {
    expectTypeOf(quantity(250, "cm")).toEqualTypeOf<Quantity<"length">>();
    expectTypeOf(quantity(2, "kg")).toEqualTypeOf<Quantity<"mass">>();
    expect(quantity(250, "cm").value).toBe(2.5);
    expect(inUnit(quantity(36, "km/h"), "m/s")).toBe(10);
    expect(inUnit(quantity(1, "kN"), "N")).toBe(1_000);
    expect(inUnit(quantity(2, "W"), "W")).toBe(2);
    expect(inUnit(quantity(0, "°C"), "K")).toBe(273.15);
    expect(inUnit(quantity(180, "deg"), "rad")).toBeCloseTo(Math.PI);
  });

  it("allows addition only for matching dimensions", () => {
    expect(inUnit(add(quantity(1, "m"), quantity(50, "cm")), "m")).toBe(1.5);
    expect(() => add(quantity(1, "m"), quantity(1, "s"))).toThrow(DimensionError);
    expect(() => inUnit(quantity(1, "kg"), "J")).toThrow(DimensionError);
    expect(subtract(quantity(10, "m"), quantity(2, "m")).value).toBe(8);
  });

  it("derives force, energy, and related dimensions from operations", () => {
    const force = forceFromMassAcceleration(quantity(2, "kg"), quantity(3, "m/s²"));
    expect(inUnit(force, "N")).toBe(6);
    const energy = kineticEnergyFromMassVelocity(quantity(2, "kg"), quantity(3, "m/s"));
    expect(inUnit(energy, "J")).toBe(9);
    expect(inUnit(springPotentialEnergy(quantity(4, "N/m"), quantity(3, "m")), "J")).toBe(18);
    expect(inUnit(gravitationalPotentialEnergy(quantity(2, "kg"), quantity(10, "m/s²"), quantity(3, "m")), "J")).toBe(60);
    expect(sameDimension(divide(quantity(10, "m"), quantity(2, "s")), quantity(5, "m/s"))).toBe(true);
    expect(multiply(quantity(1, "kg"), quantity(1, "m/s²")).kind).toBe("force");
  });

  it("supports bounded integer powers, roots, and dimensionless transcendental functions", () => {
    expect(squareRoot(power(quantity(4, "m"), 2)).value).toBe(4);
    expect(inUnit(power(quantity(2, "m"), 2), "m²")).toBe(4);
    expect(sine(quantity(90, "deg")).value).toBeCloseTo(1);
    expect(cosine(quantity(0, "rad")).value).toBe(1);
    expect(exponential(fromSI(0, "dimensionless")).value).toBe(1);
    expect(logarithm(fromSI(Math.E, "dimensionless")).value).toBeCloseTo(1);
    expect(() => sine(quantity(1, "m"))).toThrow(DimensionError);
    expect(() => exponential(quantity(1, "s"))).toThrow(DimensionError);
    expect(() => logarithm(fromSI(0, "dimensionless"))).toThrow(DimensionError);
    expect(() => squareRoot(quantity(4, "m"))).toThrow(DimensionError);
    expect(() => power(quantity(2, "m"), 0.5)).toThrow(RangeError);
  });

  it("rejects invalid numeric quantities and division by zero", () => {
    expect(() => quantity(Number.NaN, "kg")).toThrow(RangeError);
    expect(() => fromSI(Infinity, "length")).toThrow(RangeError);
    expect(() => divide(quantity(1, "m"), quantity(0, "s"))).toThrow(RangeError);
  });

  it("freezes unit catalogs and dimension vectors at runtime", () => {
    const meter = quantity(1, "m");
    const derived = multiply(quantity(1, "kg"), meter);

    expect(Object.isFrozen(DIMENSIONS)).toBe(true);
    expect(Object.isFrozen(DIMENSIONS.length)).toBe(true);
    expect(Object.isFrozen(UNIT_DEFINITIONS)).toBe(true);
    expect(Object.isFrozen(UNIT_DEFINITIONS.m)).toBe(true);
    expect(Object.isFrozen(meter.dimension)).toBe(true);
    expect(Object.isFrozen(derived.dimension)).toBe(true);
    expect(Reflect.set(DIMENSIONS.length, 1, 0)).toBe(false);
    expect(Reflect.set(UNIT_DEFINITIONS.m, "scale", 100)).toBe(false);
    expect(() => inUnit(meter, "1")).toThrow(DimensionError);
  });
});

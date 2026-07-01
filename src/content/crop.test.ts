import { test, expect } from "vitest";
import { computeCropRect } from "./crop";

test("computeCropRect scales CSS pixels to device pixels", () => {
  expect(computeCropRect({ x: 10, y: 20, w: 100, h: 40 }, 2)).toEqual({ x: 20, y: 40, w: 200, h: 80 });
});

test("computeCropRect rounds to integers", () => {
  expect(computeCropRect({ x: 10.4, y: 20.6, w: 100.5, h: 40.5 }, 1)).toEqual({ x: 10, y: 21, w: 101, h: 41 });
});

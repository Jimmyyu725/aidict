import { expect, test } from "vitest";
import { computeImageCropRect } from "./geometry";

test("maps a displayed-image selection to natural screenshot pixels", () => {
  expect(computeImageCropRect(
    { x: 150, y: 100, w: 200, h: 80 },
    { x: 50, y: 20, w: 500, h: 250 },
    1000,
    500
  )).toEqual({ x: 200, y: 160, w: 400, h: 160 });
});

test("clips a selection to the displayed image", () => {
  expect(computeImageCropRect(
    { x: 0, y: 0, w: 200, h: 150 },
    { x: 50, y: 25, w: 500, h: 250 },
    1000,
    500
  )).toEqual({ x: 0, y: 0, w: 300, h: 250 });
});

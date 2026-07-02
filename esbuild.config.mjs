import { build } from "esbuild";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const common = { bundle: true, format: "iife", target: "es2022", logLevel: "info" };

mkdirSync("dist/tesseract", { recursive: true });
mkdirSync("dist/icons", { recursive: true });

await build({ ...common, entryPoints: ["src/background/index.ts"], outfile: "dist/background.js" });
await build({ ...common, entryPoints: ["src/content/index.ts"], outfile: "dist/content.js" });
await build({ ...common, entryPoints: ["src/capture/index.ts"], outfile: "dist/capture.js" });
await build({ ...common, entryPoints: ["src/options/options.ts"], outfile: "dist/options.js" });

// Static assets
cpSync("manifest.json", "dist/manifest.json");
cpSync("src/capture/capture.html", "dist/capture.html");
cpSync("src/options/options.html", "dist/options.html");
cpSync("icons", "dist/icons", { recursive: true });

// Tesseract runtime assets (bundled locally — no CDN).
//
// We use OEM.LSTM_ONLY (oem=1) so only the *-lstm.wasm.js variants are needed.
// The .wasm.js files embed their WASM binary as base64, so the separate .wasm
// binary files are NOT required at runtime.
//
// v7 auto-detects SIMD support at runtime (via wasm-feature-detect) and loads
// the most capable variant available:
//   relaxedSimd → tesseract-core-relaxedsimd-lstm.wasm.js
//   simd        → tesseract-core-simd-lstm.wasm.js
//   fallback    → tesseract-core-lstm.wasm.js
cpSync("node_modules/tesseract.js/dist/worker.min.js",                        "dist/tesseract/worker.min.js");
cpSync("node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js",          "dist/tesseract/tesseract-core-lstm.wasm.js");
cpSync("node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js",     "dist/tesseract/tesseract-core-simd-lstm.wasm.js");
cpSync("node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "dist/tesseract/tesseract-core-relaxedsimd-lstm.wasm.js");

// Keep clean clones reproducible: fetch the OCR language data when absent and
// fail the build if it cannot be obtained or is clearly not a gzip payload.
const trainedDataPath = "dist/tesseract/eng.traineddata.gz";
const trainedDataSha256 = "18c1ac52b75e35d44735fb6c2a60acfaf23033524653200738e98f0243edb75b";
if (!existsSync(trainedDataPath)) {
  const trainedDataUrl =
    "https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_fast/eng.traineddata.gz";
  console.info("Downloading Tesseract English trained-data...");
  const response = await fetch(trainedDataUrl);
  if (!response.ok) {
    throw new Error(`Failed to download OCR trained-data: HTTP ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 1_000_000 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
    throw new Error("Downloaded OCR trained-data is invalid");
  }
  writeFileSync(trainedDataPath, bytes);
}
const trainedDataDigest = createHash("sha256").update(readFileSync(trainedDataPath)).digest("hex");
if (trainedDataDigest !== trainedDataSha256) {
  throw new Error("OCR trained-data checksum mismatch");
}
console.info(`${trainedDataPath} present — OCR will work.`);

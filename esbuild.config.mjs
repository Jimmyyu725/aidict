import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync } from "node:fs";

const common = { bundle: true, format: "iife", target: "es2022", logLevel: "info" };

mkdirSync("dist/tesseract", { recursive: true });
mkdirSync("dist/icons", { recursive: true });

await build({ ...common, entryPoints: ["src/background/index.ts"], outfile: "dist/background.js" });
await build({ ...common, entryPoints: ["src/content/index.ts"], outfile: "dist/content.js" });
await build({ ...common, entryPoints: ["src/options/options.ts"], outfile: "dist/options.js" });

// Static assets
cpSync("manifest.json", "dist/manifest.json");
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

// eng.traineddata.gz is downloaded once by scripts/fetch-traineddata.sh.
// It is not committed to the repo — warn if it is missing.
if (existsSync("dist/tesseract/eng.traineddata.gz")) {
  console.info("dist/tesseract/eng.traineddata.gz present — OCR will work.");
} else {
  console.warn("WARNING: dist/tesseract/eng.traineddata.gz missing — run: bash scripts/fetch-traineddata.sh");
}

import { build } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";

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

// Tesseract runtime assets (bundled locally — no CDN)
cpSync("node_modules/tesseract.js/dist/worker.min.js", "dist/tesseract/worker.min.js");
cpSync("node_modules/tesseract.js-core/tesseract-core-simd.wasm.js", "dist/tesseract/tesseract-core-simd.wasm.js");
cpSync("node_modules/tesseract.js-core/tesseract-core-simd.wasm", "dist/tesseract/tesseract-core-simd.wasm");
// eng.traineddata.gz must be placed here in Task 12 (downloaded once).

import { createWorker } from "tesseract.js";

// Lazy-initialised Tesseract worker (browser; assets served from extension).
// NOTE: createWorker returns a Promise<Worker> in v7, so we store the promise
// and await it on every call – the underlying worker is only created once.
let workerPromise: ReturnType<typeof createWorker> | null = null;

function assetUrl(path: string): string {
  return chrome.runtime.getURL(`tesseract/${path}`);
}

function getWorker() {
  if (!workerPromise) {
    // v7 API: createWorker(langs, oem, options)
    //   workerPath – URL to the blob-wrapped web worker script
    //   corePath   – DIRECTORY URL; v7 auto-selects the right *.wasm.js variant
    //                based on SIMD/relaxedSIMD support at runtime
    //   langPath   – DIRECTORY URL containing eng.traineddata.gz
    //   gzip       – true (default; explicit for clarity)
    //
    // The blob-worker mechanism (workerBlobURL: true, the default) wraps the
    // workerPath in `importScripts(workerPath)` inside a Blob URL, so the
    // actual worker runs from a blob: URL rather than a chrome-extension:// URL.
    // This avoids cross-origin Worker restrictions in content scripts, because
    // the chrome-extension:// assets are declared as web_accessible_resources
    // and can be fetched/importScripts-ed by any web page.
    workerPromise = createWorker("eng", 1, {
      workerPath: assetUrl("worker.min.js"),
      corePath: assetUrl(""), // directory – v7 appends the right variant filename
      langPath: assetUrl(""), // directory – v7 appends eng.traineddata.gz
      gzip: true,
    });
  }
  return workerPromise;
}

export async function ocrImage(dataUrl: string): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(dataUrl);
  return data.text;
}

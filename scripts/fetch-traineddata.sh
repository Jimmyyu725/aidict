#!/usr/bin/env bash
# Download the Tesseract English trained-data (fast model, compatible with
# tesseract.js-core v5/v6) into dist/tesseract/ for local OCR in the extension.
# Run once after cloning; re-run if the file is missing or stale.
set -euo pipefail

mkdir -p dist/tesseract

# The 4.0.0_fast model from naptha/tessdata is compatible with tesseract.js-core v5+.
# Using the raw GitHub URL; fall back to the jsDelivr CDN mirror if GitHub is slow.
DEST="dist/tesseract/eng.traineddata.gz"
URL="https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_fast/eng.traineddata.gz"

echo "Downloading eng.traineddata.gz ..."
curl -fsSL -o "$DEST" "$URL"

SIZE=$(wc -c < "$DEST")
echo "Downloaded $DEST (${SIZE} bytes)"

import { LookupRequest, LookupResponse } from "../shared/types";
import { Card, CardState } from "../content/card";
import { cropDataUrl, Rect } from "../content/crop";
import { ocrImage } from "../content/ocr";
import { tokenizeWords } from "../content/tokenize";
import { computeImageCropRect } from "./geometry";

const PENDING_CAPTURE_KEY = "pending-restricted-capture";

function setStatus(message: string): void {
  const toolbar = document.getElementById("toolbar");
  if (toolbar) toolbar.textContent = message;
}

async function main(): Promise<void> {
  const stored = await chrome.storage.session.get([PENDING_CAPTURE_KEY]);
  const dataUrl = stored[PENDING_CAPTURE_KEY];
  await chrome.storage.session.remove([PENDING_CAPTURE_KEY]);
  if (typeof dataUrl !== "string") {
    setStatus("No captured page found. Return to the PDF and press Alt+D again.");
    return;
  }

  const image = document.getElementById("capture") as HTMLImageElement;
  const stage = document.getElementById("stage") as HTMLDivElement;
  const box = document.getElementById("box") as HTMLDivElement;
  const picker = document.getElementById("picker") as HTMLDivElement;
  const card = new Card();
  image.src = dataUrl;
  await image.decode();

  let startX = 0;
  let startY = 0;
  let dragging = false;

  async function lookup(word: string, context: string, x: number, y: number): Promise<void> {
    card.showAt(x, y, { kind: "loading" });
    const req: LookupRequest = { type: "lookup", term: word, context };
    let state: CardState;
    try {
      const resp = (await chrome.runtime.sendMessage(req)) as LookupResponse;
      state = resp.ok
        ? { kind: "result", result: resp.result }
        : {
            kind: "error",
            message: resp.error === "NO_API_KEY" ? "Set your OpenAI key in options" : resp.error,
            canRetry: false,
          };
    } catch {
      state = { kind: "error", message: "Extension error — please retry", canRetry: false };
    }
    card.setState(state);
  }

  function showWords(words: string[], context: string, x: number, y: number): void {
    picker.replaceChildren();
    picker.style.left = `${Math.max(8, Math.min(x, window.innerWidth - 430))}px`;
    picker.style.top = `${Math.max(54, Math.min(y + 8, window.innerHeight - 120))}px`;
    for (const word of words) {
      const button = document.createElement("button");
      button.textContent = word;
      button.addEventListener("click", () => {
        picker.style.display = "none";
        void lookup(word, context, x, y);
      });
      picker.appendChild(button);
    }
    picker.style.display = "block";
    setStatus("Choose the word to look up");
  }

  stage.addEventListener("mousedown", (event) => {
    const imageRect = image.getBoundingClientRect();
    if (
      event.clientX < imageRect.left || event.clientX > imageRect.right ||
      event.clientY < imageRect.top || event.clientY > imageRect.bottom
    ) return;
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    picker.style.display = "none";
    card.hide();
    box.style.display = "block";
    box.style.left = `${startX}px`;
    box.style.top = `${startY}px`;
    box.style.width = "0";
    box.style.height = "0";
  });

  stage.addEventListener("mousemove", (event) => {
    if (!dragging) return;
    box.style.left = `${Math.min(startX, event.clientX)}px`;
    box.style.top = `${Math.min(startY, event.clientY)}px`;
    box.style.width = `${Math.abs(event.clientX - startX)}px`;
    box.style.height = `${Math.abs(event.clientY - startY)}px`;
  });

  stage.addEventListener("mouseup", async (event) => {
    if (!dragging) return;
    dragging = false;
    box.style.display = "none";
    const dragRect: Rect = {
      x: Math.min(startX, event.clientX),
      y: Math.min(startY, event.clientY),
      w: Math.abs(event.clientX - startX),
      h: Math.abs(event.clientY - startY),
    };
    if (dragRect.w < 4 || dragRect.h < 4) return;
    const displayed = image.getBoundingClientRect();
    const cropRect = computeImageCropRect(
      dragRect,
      { x: displayed.left, y: displayed.top, w: displayed.width, h: displayed.height },
      image.naturalWidth,
      image.naturalHeight
    );
    if (cropRect.w < 2 || cropRect.h < 2) return;

    setStatus("Recognizing text…");
    try {
      const cropped = await cropDataUrl(dataUrl, cropRect);
      const text = (await ocrImage(cropped)).trim();
      const words = tokenizeWords(text);
      if (words.length === 0) {
        setStatus("No text found — try a tighter box");
      } else if (words.length === 1) {
        setStatus("Looking up…");
        await lookup(words[0], text, dragRect.x + dragRect.w, dragRect.y + dragRect.h);
      } else {
        showWords(words, text, dragRect.x + dragRect.w, dragRect.y + dragRect.h);
      }
    } catch {
      setStatus("OCR failed — return to the PDF and try again");
    }
  });
}

void main().catch((error) => {
  console.error("[AIDict] capture page failed:", error);
  setStatus("Capture failed — return to the PDF and press Alt+D again");
});

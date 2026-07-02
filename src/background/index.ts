import { RuntimeRequest, LookupResponse, CaptureResponse, ToContentMessage } from "../shared/types";
import { loadSettings, StorageArea } from "../shared/settings";
import { lookup } from "./lookup";

const storage: StorageArea = {
  get: (keys) => chrome.storage.local.get(keys),
  set: (items) => chrome.storage.local.set(items),
};

async function handleLookup(term: string, context: string): Promise<LookupResponse> {
  try {
    const settings = await loadSettings(storage);
    const { result, cached } = await lookup(term, context, { storage, settings, now: Date.now() });
    return { ok: true, result, cached };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function handleCapture(): Promise<CaptureResponse> {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: "png" });
    return { ok: true, dataUrl };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

chrome.runtime.onMessage.addListener((msg: RuntimeRequest, _sender, sendResponse) => {
  if (msg.type === "lookup") { handleLookup(msg.term, msg.context).then(sendResponse); return true; }
  if (msg.type === "capture") { handleCapture().then(sendResponse); return true; }
  return false;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "capture") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) {
    const msg: ToContentMessage = { type: "enter-capture" };
    chrome.tabs.sendMessage(tab.id, msg, { frameId: 0 }).catch(() => {});
  }
});

import { loadSettings, saveSettings, StorageArea } from "../shared/settings";

const storage: StorageArea = {
  get: (keys) => chrome.storage.local.get(keys),
  set: (items) => chrome.storage.local.set(items),
};

function $(id: string): HTMLInputElement { return document.getElementById(id) as HTMLInputElement; }

async function init(): Promise<void> {
  const s = await loadSettings(storage);
  $("apiKey").value = s.apiKey;
  $("model").value = s.model;
  $("targetLang").value = s.targetLang;
  $("cacheTtlDays").value = String(s.cacheTtlDays);

  document.getElementById("save")!.addEventListener("click", async () => {
    await saveSettings(storage, {
      apiKey: $("apiKey").value.trim(),
      model: $("model").value.trim() || "gpt-4o-mini",
      targetLang: $("targetLang").value.trim() || "Chinese",
      cacheTtlDays: Number($("cacheTtlDays").value) || 30,
    });
    const status = document.getElementById("status")!;
    status.textContent = "Saved";
    setTimeout(() => (status.textContent = ""), 1500);
  });
}

void init();

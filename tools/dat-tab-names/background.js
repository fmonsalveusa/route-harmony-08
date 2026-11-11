// Llamadas con Google Voice: reutiliza la pestaña de Voice que ya esté abierta en vez de abrir una nueva
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "voice-call" || !msg.url) return;
  (async () => {
    const tabs = await chrome.tabs.query({ url: "https://voice.google.com/*" });
    // Si la pestaña suena (llamada en curso), no se toca para no cortar la llamada
    const tab = tabs.find((t) => !t.audible);
    if (tab) {
      await chrome.tabs.update(tab.id, { url: msg.url, active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    } else {
      await chrome.tabs.create({ url: msg.url });
    }
  })().catch((e) => console.error("voice-call:", e));
});

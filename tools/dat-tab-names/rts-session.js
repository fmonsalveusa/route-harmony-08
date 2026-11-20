// Corre en rtspro.com (mundo aislado de la extensión). Recibe de rts-capture.js la sesión con la
// que la página de RTS hace sus consultas y la guarda en el almacenamiento local de la extensión,
// para que el chip de RTS en DAT consulte con TU sesión. No sale de este Chrome.
(() => {
  const expOf = (jwt) => {
    try { return JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp * 1000 || 0; } catch { return 0; }
  };
  let last = "";
  window.addEventListener("message", (e) => {
    if (e.source !== window || typeof e.data?.__duRtsToken !== "string") return;
    const token = e.data.__duRtsToken;
    const exp = expOf(token);
    if (token === last || exp <= Date.now()) return;
    last = token;
    chrome.storage.local.set({ rtsAuth: { token, exp, at: Date.now() } });
  });
})();

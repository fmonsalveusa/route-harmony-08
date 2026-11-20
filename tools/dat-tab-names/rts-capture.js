// Corre DENTRO de la página de rtspro.com (mundo MAIN). Cuando la página de RTS llama a sus
// servicios con tu sesión ("Authorization: Bearer …"), avisa a rts-session.js para que la
// extensión pueda consultar el crédito de brokers con esa misma sesión. No sale de este Chrome.
(() => {
  const send = (url, value) => {
    try {
      if (!/^https:\/\/[\w.-]*rtspro\.com\//.test(String(url))) return;
      const m = String(value || "").match(/^Bearer\s+(eyJ[\w-]+\.[\w-]+\.[\w-]+)$/);
      if (m) window.postMessage({ __duRtsToken: m[1] }, location.origin);
    } catch {}
  };

  const open = XMLHttpRequest.prototype.open;
  const setHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (method, url) { this.__duUrl = url; return open.apply(this, arguments); };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    if (String(k).toLowerCase() === "authorization") send(this.__duUrl, v);
    return setHeader.apply(this, arguments);
  };

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === "string" ? input : input?.url;
      const h = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      send(url, h.get("authorization"));
    } catch {}
    return origFetch.apply(this, arguments);
  };
})();

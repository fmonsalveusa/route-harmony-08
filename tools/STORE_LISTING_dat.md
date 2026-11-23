# Chrome Web Store — Dispatch Up – Dispatcher Tools (tools/dat-tab-names)

Paquete: `store/dat-driver-tabs-store-<versión>.zip` (lo genera `node scripts/build-extensions.mjs`; sin `key`).
Imágenes: `store/screenshot-1280x800.png`, `store/promo-440x280.png`. Ícono 128: `tools/dat-tab-names/icons/icon128.png`.
Visibilidad: **No listada** (solo con el enlace). Política de privacidad: https://www.dispatch-up.com/extension-privacy

Para versiones nuevas: subir `version` en manifest.json → build → en el panel "Package → Upload new package" → enviar a revisión. Chrome actualiza solo a todos.

## Ficha (Store listing)

**Name:** Dispatch Up – Dispatcher Tools

**Summary (máx. 132):**
Internal tools for Dispatch Up dispatchers: driver name per search tab, broker credit rating, destination market and broker email.

**Description:**
Internal tool for the dispatchers of 58 Logistics LLC and companies using the Dispatch Up TMS. It adds small helpers to the load board pages you already use:

• Driver name on every load-search tab, so you always know which driver a search belongs to.
• Broker credit rating (A–F, NO BUY, average days to pay) from your own RTS account, looked up by the broker's MC number.
• Destination market: hot / neutral / cold outbound market of the destination zone (from the market data page you open), weighted by load volume.
• One-click email to the broker with your own template, from the load row, the load details or an email written in the comments. Sent from the company mailbox through Dispatch Up.
• Click-to-call broker phone numbers with Google Voice.

Requires a Dispatch Up access key for sending emails. Not affiliated with or endorsed by DAT Solutions or RTS Financial.

**Category:** Productivity / Workflow & Planning
**Language:** English (United States)

## Privacy practices

**Single purpose:**
Help Dispatch Up dispatchers work load board searches faster: label each search with its driver, show the broker's credit rating and destination market next to each load, and email or call the broker in one click.

**Permission justifications:**
- `storage`: save the user's settings (email template, Dispatch Up key, driver names per tab), the RTS session and cached ratings/market data in the browser.
- `alarms`: check periodically for a newer extension version and refresh cached data.
- Host `one.dat.com`: add the driver labels, ratings, market icons and email buttons to the load board pages.
- Host `iq.prod.dat.com`: read the market conditions data the page already loads, to show the destination market on the load board.
- Host `rtspro.com` / `stc-debtor-service.rtspro.com`: reuse the user's own RTS session to look up a broker's credit rating by MC number.
- Host `tejzatzzwivvaznxyqej.supabase.co` / `www.dispatch-up.com`: send the broker email through the company's Dispatch Up account and check for a newer version.
- Host `voice.google.com`: open Google Voice to call the broker's phone number.

**Remote code:** No, I am not using remote code.

**Data usage (marcar):**
- ✅ Authentication information (RTS session token, kept locally only)
- ✅ Website content (load board data shown to the user)
- ✅ Personally identifiable information (broker contact name/email when sending an email)
- Certificar: no se vende, no se usa para fines ajenos al propósito único, no se usa para crédito/préstamos.



## Corregir nombre de la app de "Load Up" a "Dispatch Up"

El nombre "Load Up" aparece en varios lugares que controlan cómo se muestra la app al instalarla como PWA en iPhone y Android. Se necesita actualizar a "Dispatch Up" en todos ellos.

### Cambios

**1. `vite.config.ts`** — Manifest PWA
- `name`: "Load Up Driver" → "Dispatch Up Driver"
- `short_name`: "LoadUp" → "DispatchUp"
- `description`: "Driver mobile app for Load Up TMS" → "Driver mobile app for Dispatch Up TMS"

**2. `index.html`** — Meta tags
- `apple-mobile-web-app-title`: "Load Up Driver" → "Dispatch Up Driver"
- `og:title`: "Load Up TMS" → "Dispatch Up TMS"

**3. `ios/App/App/public/manifest.webmanifest`** (copia estática para iOS nativo)
- `name`: "Load Up Driver" → "Dispatch Up Driver"
- `short_name`: "LoadUp" → "DispatchUp"

Nota: después de publicar, los usuarios que ya instalaron la PWA con el nombre anterior necesitarán desinstalar y reinstalar para ver el nuevo nombre.


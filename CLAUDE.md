# Dispatch Up TMS

## Stack
- React + Vite + TypeScript
- Capacitor (iOS/Android)
- Supabase (auth + DB)
- Mapbox Directions API (token: VITE_MAPBOX_TOKEN en Vercel)
- Lovable AI para desarrollo

## Estructura clave
- /src/components → UI
- /src/hooks → lógica de negocio
- /src/pages → vistas principales

## Reglas CRÍTICAS
- NO tocar la sección server en capacitor.config.ts → rompe builds Android
- Bundle ID iOS: com.dispatchup.driver
- Bundle ID Android: com.dispatchup.driver2
- MainActivity.java debe crearse manualmente después de npx cap add android
- No leer: node_modules/, dist/, build/, public/, archivos .lock .log e imágenes

## Contexto del negocio
- TMS multi-tenant para owner operators de boxtruck y hotshot
- App móvil llamada Dispatch Up Driver
- Empresa: 58 Logistics LLC, Charlotte NC

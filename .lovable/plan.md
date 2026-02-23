

# Toggle de Tema Dark/Light (Web + Driver App)

Agregar un boton/switch para cambiar entre modo claro y oscuro en ambas interfaces, manteniendo la opcion de seguir el tema del sistema como default.

---

## Cambios

### 1. Nuevo componente: `src/components/ThemeToggle.tsx`
- Un boton simple que alterna entre light, dark, y system usando `useTheme()` de `next-themes`
- Muestra un icono de sol (light), luna (dark), o monitor (system)
- Click rota entre: system -> light -> dark -> system

### 2. App Web - `src/components/AppLayout.tsx`
- Agregar el `ThemeToggle` en el header, junto al badge de rol y el boton de sign-out
- Se vera como un icono pequeno mas en la barra superior

### 3. Driver App - `src/pages/driver-app/DriverProfile.tsx`
- Agregar una seccion "Appearance" con 3 opciones (System, Light, Dark) en la pagina de perfil del driver
- Usar botones estilo radio/segmented para que sea facil de seleccionar

### 4. Driver App - Status Bar sync
- En `src/components/driver-app/DriverMobileLayout.tsx`, actualizar el color del status bar nativo segun el tema activo (dark = fondo oscuro, light = fondo claro)

---

## Seccion tecnica

- `next-themes` ya esta instalado y el `ThemeProvider` ya tiene `defaultTheme="system"` y `enableSystem`
- `useTheme()` da acceso a `theme`, `setTheme`, y `resolvedTheme`
- La preferencia se guarda automaticamente en `localStorage` por `next-themes`
- No se necesitan cambios en la base de datos ni CSS adicional (las variables dark ya estan definidas en `index.css`)


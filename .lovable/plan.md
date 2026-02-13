

## Reorganizar la seccion de Registro de Driver en la Landing Page

### Problema actual
La landing page muestra dos formularios grandes uno tras otro (Agendar Reunion + Registro de Driver), lo cual se ve cargado visualmente.

### Solucion propuesta
Reemplazar el formulario visible de registro por una seccion compacta tipo "call-to-action" con un boton prominente "Registrate como Driver". Al pulsarlo, se mostrara el formulario con una animacion suave.

### Cambios en `src/components/landing/OnboardingSection.tsx`

1. **Agregar un estado `showForm`** (inicialmente `false`) para controlar la visibilidad del formulario.

2. **Vista inicial (formulario oculto)**: Mostrar la seccion con el texto motivacional existente (titulo, descripcion, lista de beneficios) y un boton grande y visible "Registrate como Driver" que al hacer clic cambia `showForm` a `true`.

3. **Vista expandida (formulario visible)**: Al pulsar el boton, el formulario actual aparece con una animacion usando `framer-motion` (`AnimatePresence` + `motion.div`). Se reemplaza el boton por el formulario completo.

4. **Layout**: Cuando el formulario esta oculto, la seccion se centra en una sola columna con el CTA prominente. Cuando se muestra, vuelve al grid de 2 columnas actual con el formulario a la derecha.

### Detalles tecnicos

- Se usara `AnimatePresence` de `framer-motion` (ya importado) para animar la aparicion del formulario.
- El boton "Registrate como Driver" usara los estilos de accent existentes (`bg-accent text-accent-foreground`) con un tamano grande para destacar.
- No se requieren cambios en la base de datos ni en otros archivos. Solo se modifica `OnboardingSection.tsx`.


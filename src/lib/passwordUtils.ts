/**
 * Genera la contraseña por defecto para un usuario nuevo.
 * Formato: inicial del nombre + apellido + año actual
 * Ejemplo: "Jose Alvarado" → "jalvarado2026"
 */
export function generateDefaultPassword(fullName: string): string {
  const year = new Date().getFullYear();

  // Normalizar: quitar acentos, minúsculas, solo letras
  const clean = (s: string) =>
    s.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // quita acentos
      .replace(/[^a-zA-Z]/g, '')          // solo letras
      .toLowerCase();

  const parts = fullName.trim().split(/\s+/).map(clean).filter(Boolean);

  if (parts.length === 0) return `user${year}`;

  // Un solo nombre → nombre completo + año
  if (parts.length === 1) return `${parts[0]}${year}`;

  // Inicial del primer nombre + último apellido + año
  const initial = parts[0][0];
  const lastName = parts[parts.length - 1];
  let password = `${initial}${lastName}${year}`;

  // Supabase exige mínimo 8 caracteres — fallback si queda muy corta
  if (password.length < 8) {
    password = `${parts.join('')}${year}`;
  }

  return password;
}

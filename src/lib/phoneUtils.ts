/**
 * Formats a phone number to (XXX) XXX-XXXX format.
 * Handles inputs like: 1234567890, 123-456-7890, (123) 456-7890, +11234567890
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  // Strip everything except digits
  const digits = phone.replace(/\D/g, '');
  // Handle country code prefix (1XXXXXXXXXX)
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length !== 10) return phone; // Return original if not 10 digits
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

/**
 * Formats a phone number as the user types (for input fields).
 * Returns formatted string for display in inputs.
 */
export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

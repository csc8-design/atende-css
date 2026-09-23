/**
 * Masks the last 4 digits of a phone number for non-admin/manager users.
 * Example: "5511999887766" → "55119998****"
 */
export function maskPhone(phone: string, shouldMask: boolean): string {
  if (!shouldMask || !phone || phone.length <= 4) return phone;
  return phone.slice(0, -4) + "****";
}

/**
 * Masks the local part of an email (before @) for non-admin/manager users.
 * Example: "joao.silva@empresa.com" → "****@empresa.com"
 */
export function maskEmail(email: string, shouldMask: boolean): string {
  if (!shouldMask || !email) return email;
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return email;
  return "****" + email.slice(atIndex);
}

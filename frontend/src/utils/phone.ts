export function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits[0] === "7" || digits[0] === "8") digits = digits.slice(1);
  digits = digits.slice(0, 10);
  let result = "+7";
  if (digits.length) result += ` (${digits.slice(0, 3)}`;
  if (digits.length > 3) result += `) ${digits.slice(3, 6)}`;
  if (digits.length > 6) result += `-${digits.slice(6, 8)}`;
  if (digits.length > 8) result += `-${digits.slice(8)}`;
  return result;
}

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return /^[78]\d{10}$/.test(digits) ? `+7${digits.slice(1)}` : value;
}

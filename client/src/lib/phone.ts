export const normalizeRussianPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const subscriber = digits.startsWith("7") || digits.startsWith("8") ? digits.slice(1) : digits;
  return `7${subscriber.slice(0, 10)}`;
};

export const formatRussianPhone = (value: string) => {
  const normalized = normalizeRussianPhone(value);
  if (!normalized) return "";
  const rest = normalized.slice(1);
  return `+7${rest.length ? ` (${rest.slice(0, 3)}` : ""}${rest.length >= 3 ? ") " : ""}${rest.slice(3, 6)}${rest.length >= 6 ? "-" : ""}${rest.slice(6, 8)}${rest.length >= 8 ? "-" : ""}${rest.slice(8, 10)}`;
};

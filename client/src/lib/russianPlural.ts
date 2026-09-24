export function russianCountNoun(count: number, forms: readonly [one: string, few: string, many: string]) {
  const absolute = Math.abs(Math.trunc(count));
  const lastTwo = absolute % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  const last = absolute % 10;
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

export function positionLabel(count: number) {
  return `${count} ${russianCountNoun(count, ["позиция", "позиции", "позиций"] as const)}`;
}

function parts(value: string): number[] {
  return value.split(/[.-]/).map(part => {
    const match = /^\d+/.exec(part);
    return match ? Number(match[0]) : 0;
  });
}

export function compareFirmware(a: string, b: string): number {
  const left = parts(a), right = parts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference) return difference < 0 ? -1 : 1;
  }
  return 0;
}

export function inRange(firmware: string, minimum: string | null, maximum: string | null): boolean {
  return (minimum === null || compareFirmware(firmware, minimum) >= 0)
    && (maximum === null || compareFirmware(firmware, maximum) <= 0);
}

export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function seededUnit(seed: string): number {
  let value = hashSeed(seed) + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

export function seededInteger(seed: string, min: number, max: number): number {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) {
    throw new Error("Seeded integer bounds must be safe integers with max >= min");
  }
  return min + Math.floor(seededUnit(seed) * (max - min + 1));
}

export function seededChoice<T>(seed: string, values: readonly T[]): T {
  if (values.length === 0) {
    throw new Error("Cannot choose from an empty collection");
  }
  return values[seededInteger(seed, 0, values.length - 1)]!;
}

export function seededShuffle<T>(seed: string, values: readonly T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = seededInteger(`${seed}:${index}`, 0, index);
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

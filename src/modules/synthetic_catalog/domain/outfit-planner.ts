import type { OutfitSlot } from "../config/profiles";

export interface OutfitStyle {
  id: number;
  productId: number;
  externalId: string;
  department: string;
  season: string;
  outfitSlot: OutfitSlot;
  colorHex: string;
}
export interface PlannedOutfitItem { style: OutfitStyle; outfitSlot: OutfitSlot; score: number; reason: string }
export interface PlannedOutfit { anchor: OutfitStyle; items: PlannedOutfitItem[]; status: "PLANNED" | "SKIPPED"; reason: string; scoringSnapshot: Record<string, unknown> }

const OPTIONAL_SLOTS: OutfitSlot[] = ["OUTERWEAR", "FOOTWEAR", "BAG", "ACCESSORY"];
const NEUTRAL_SATURATION = 0.18;

function hueSaturation(hex: string): { hue: number; saturation: number; neutral: boolean } {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return { hue: 0, saturation: 0, neutral: true };
  const values = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = values as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let hue = 0;
  if (delta) hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  const saturation = max === 0 ? 0 : delta / max;
  return { hue, saturation, neutral: saturation <= NEUTRAL_SATURATION };
}

export function scoreColorPair(anchorHex: string, companionHex: string): number {
  const a = hueSaturation(anchorHex), b = hueSaturation(companionHex);
  if (a.neutral || b.neutral) return 3;
  const distance = Math.min(Math.abs(a.hue - b.hue), 360 - Math.abs(a.hue - b.hue));
  if (distance <= 24) return 3.5; // monochromatic
  if (distance <= 70) return 4; // analogous
  if (distance >= 145 && distance <= 215) return 1.5; // restrained complement
  return 0;
}

function compatibleSeason(anchor: string, other: string): boolean {
  return anchor.toLocaleLowerCase() === "core" || other.toLocaleLowerCase() === "core" || anchor.toLocaleLowerCase() === other.toLocaleLowerCase();
}

function deterministicTie(anchorId: number, styleId: number): number {
  let hash = 2166136261;
  for (const char of `${anchorId}:${styleId}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function recipes(slot: OutfitSlot): OutfitSlot[][] {
  if (slot === "TOP") return [["BOTTOM"]];
  if (slot === "BOTTOM") return [["TOP"]];
  if (slot === "ONE_PIECE") return [OPTIONAL_SLOTS];
  if (slot === "OUTERWEAR") return [["TOP", "BOTTOM"], ["ONE_PIECE"]];
  return [["TOP", "BOTTOM"], ["ONE_PIECE"]];
}

export function planOutfits(styles: OutfitStyle[], reuseCounts: ReadonlyMap<number, number> = new Map()): PlannedOutfit[] {
  const orderedAnchors = [...styles].sort((a, b) => a.id - b.id);
  const reuse = new Map(reuseCounts);
  const results: PlannedOutfit[] = [];
  for (const anchor of orderedAnchors) {
    const candidates = styles.filter((candidate) => candidate.id !== anchor.id && candidate.productId !== anchor.productId && candidate.department === anchor.department && compatibleSeason(anchor.season, candidate.season));
    const ranked = (slot: OutfitSlot, selected: Set<number>, selectedStyles: OutfitStyle[] = []) => {
      const alreadyHasAccent = [anchor, ...selectedStyles].some((item) => !hueSaturation(item.colorHex).neutral);
      return candidates.filter((item) => item.outfitSlot === slot && !selected.has(item.productId) && (hueSaturation(item.colorHex).neutral || !alreadyHasAccent)).sort((a, b) => {
      const accentPenalty = (style: OutfitStyle) => !hueSaturation(style.colorHex).neutral && alreadyHasAccent ? 5 : 0;
      const scoreA = scoreColorPair(anchor.colorHex, a.colorHex) - (reuse.get(a.id) ?? 0) * 0.8 - accentPenalty(a);
      const scoreB = scoreColorPair(anchor.colorHex, b.colorHex) - (reuse.get(b.id) ?? 0) * 0.8 - accentPenalty(b);
      return scoreB - scoreA || deterministicTie(anchor.id, a.id) - deterministicTie(anchor.id, b.id) || a.id - b.id;
    });
    };
    let selected: OutfitStyle[] | undefined;
    for (const recipe of recipes(anchor.outfitSlot)) {
      if (anchor.outfitSlot === "ONE_PIECE") {
        const options: OutfitStyle[] = [];
        for (const slot of OPTIONAL_SLOTS) {
          const candidate = ranked(slot, new Set(options.map((item) => item.productId)), options)[0];
          if (candidate) options.push(candidate);
        }
        if (options.length) selected = options.slice(0, 3);
      } else {
        const usedProducts = new Set<number>();
        const required: OutfitStyle[] = [];
        for (const slot of recipe) {
          const candidate = ranked(slot, usedProducts, required)[0];
          if (candidate) { required.push(candidate); usedProducts.add(candidate.productId); }
        }
        if (required.length === recipe.length) {
          const optional: OutfitStyle[] = [];
          for (const slot of OPTIONAL_SLOTS) {
            if (required.length + optional.length >= 3) break;
            const candidate = ranked(slot, new Set([...usedProducts, ...optional.map((item) => item.productId)]), [...required, ...optional])[0];
            if (candidate) optional.push(candidate);
          }
          selected = [...required, ...optional];
        }
      }
      if (selected?.length) break;
    }
    if (!selected?.length) {
      results.push({ anchor, items: [], status: "SKIPPED", reason: `No eligible companions satisfy the ${anchor.outfitSlot.toLowerCase().replaceAll("_", " ")} outfit recipe in ${anchor.department} and ${anchor.season}.`, scoringSnapshot: { seed: `${anchor.id}`, ruleVersion: 1, reuseCounts: Object.fromEntries(reuse) } });
      continue;
    }
    const items = selected.map((style) => {
      reuse.set(style.id, (reuse.get(style.id) ?? 0) + 1);
      const score = scoreColorPair(anchor.colorHex, style.colorHex) - ((reuse.get(style.id) ?? 1) - 1) * 0.8;
      return { style, outfitSlot: style.outfitSlot, score, reason: score >= 3 ? "neutral or harmonious colour" : "balanced recipe selection" };
    });
    results.push({ anchor, items, status: "PLANNED", reason: "Deterministic department, season, garment-slot, colour, and reuse rules.", scoringSnapshot: { seed: `${anchor.id}`, ruleVersion: 1, reuseCounts: Object.fromEntries(reuse), selectedScores: items.map(({ style, score }) => ({ styleId: style.id, score })) } });
  }
  return results;
}

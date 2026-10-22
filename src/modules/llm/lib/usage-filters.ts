export const LLM_USAGE_RANGE_VALUES = ["7d", "30d", "90d", "custom", "all"] as const;
export type LLMUsageRange = (typeof LLM_USAGE_RANGE_VALUES)[number];

export const LLM_USAGE_OPERATIONS = [
  "CHAT_COMPLETION",
  "IMAGE_GENERATION",
  "IMAGE_EDIT",
] as const;
export type LLMUsageOperationFilter = (typeof LLM_USAGE_OPERATIONS)[number];

export type LLMUsageFilterInput = {
  range?: string;
  from?: string;
  to?: string;
  model?: string;
  feature?: string;
  operation?: string;
};

export type LLMUsageFilters = {
  range: LLMUsageRange;
  from?: Date;
  toExclusive?: Date;
  fromInput: string;
  toInput: string;
  model?: string;
  feature?: string;
  operation?: LLMUsageOperationFilter;
  label: string;
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateInput(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || dateInput(parsed) !== value ? null : parsed;
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function optionalFilter(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "all" ? trimmed.slice(0, 200) : undefined;
}

export function parseLLMUsageFilters(
  input: LLMUsageFilterInput,
  now = new Date(),
): LLMUsageFilters {
  const requestedRange = LLM_USAGE_RANGE_VALUES.includes(input.range as LLMUsageRange)
    ? (input.range as LLMUsageRange)
    : "30d";
  const today = startOfUtcDay(now);
  const tomorrow = addUtcDays(today, 1);

  let range = requestedRange;
  let from: Date | undefined;
  let toExclusive: Date | undefined;
  let fromInput = "";
  let toInput = "";
  let label = "All time";

  if (requestedRange === "custom") {
    const parsedFrom = parseDateInput(input.from);
    const parsedTo = parseDateInput(input.to);
    if (parsedFrom && parsedTo && parsedFrom <= parsedTo) {
      from = parsedFrom;
      toExclusive = addUtcDays(parsedTo, 1);
      fromInput = dateInput(parsedFrom);
      toInput = dateInput(parsedTo);
      label = `${fromInput} to ${toInput}`;
    } else {
      range = "30d";
    }
  }

  if (["7d", "30d", "90d"].includes(range)) {
    const days = Number(range.slice(0, -1));
    from = addUtcDays(today, -(days - 1));
    toExclusive = tomorrow;
    fromInput = dateInput(from);
    toInput = dateInput(today);
    label = `Last ${days} days`;
  }

  return {
    range,
    from,
    toExclusive,
    fromInput,
    toInput,
    model: optionalFilter(input.model),
    feature: optionalFilter(input.feature),
    operation: LLM_USAGE_OPERATIONS.includes(input.operation as LLMUsageOperationFilter)
      ? (input.operation as LLMUsageOperationFilter)
      : undefined,
    label,
  };
}

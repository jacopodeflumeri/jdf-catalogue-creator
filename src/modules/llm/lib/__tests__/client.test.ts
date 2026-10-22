/** @jest-environment node */

/**
 * Tests for LLM client module
 *
 * Verifies:
 * 1. Model constants have provider prefixes
 * 2. Billing subject construction (internal vs customer)
 * 3. Metadata structure and field inclusion
 * 4. Environment variable precedence
 * 5. APP_NAME / APP_PRODUCT validation
 * 6. Unknown product warning
 */

const mockCreate = jest.fn();
const mockRecordLLMUsage = jest.fn();

jest.mock("openai", () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

jest.mock("../usage-recorder", () => ({
  recordLLMUsage: (...args: unknown[]) => mockRecordLLMUsage(...args),
}));

jest.mock("@/lib/utils/logger", () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { buildBillingParams, llmCompletion, _resetProductWarning } from "../client";
import { MODELS } from "../models";
import logger from "@/lib/utils/logger";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const savedEnv: Record<string, string | undefined> = {};

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(overrides)) {
    if (!(key in savedEnv)) savedEnv[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function restoreEnv() {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  // Clear saved entries
  for (const key of Object.keys(savedEnv)) delete savedEnv[key];
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  _resetProductWarning();
  jest.clearAllMocks();
  // Set defaults so buildBillingParams doesn't throw on APP_NAME/APP_PRODUCT
  setEnv({
    APP_NAME: "test-app",
    APP_PRODUCT: "internal",
  });
});

afterEach(() => {
  restoreEnv();
});

// ---------------------------------------------------------------------------
// MODELS
// ---------------------------------------------------------------------------

describe("MODELS", () => {
  it("all model names include a provider prefix", () => {
    for (const [key, value] of Object.entries(MODELS)) {
      expect(value).toMatch(
        /^(anthropic|openai)\//,
        `MODELS.${key} ("${value}") is missing a provider prefix`,
      );
    }
  });

  it("anthropic models use the anthropic prefix", () => {
    expect(MODELS.OPUS).toMatch(/^anthropic\//);
    expect(MODELS.SONNET).toMatch(/^anthropic\//);
    expect(MODELS.HAIKU).toMatch(/^anthropic\//);
  });

  it("openai models use the openai prefix", () => {
    expect(MODELS.GPT_5_4).toMatch(/^openai\//);
    expect(MODELS.GPT_5_4_MINI).toMatch(/^openai\//);
    expect(MODELS.GPT_5_4_NANO).toMatch(/^openai\//);
    expect(MODELS.GPT_4O).toMatch(/^openai\//);
    expect(MODELS.GPT_4O_MINI).toMatch(/^openai\//);
  });

  it("has distinct models within each provider tier", () => {
    const values = Object.values(MODELS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// buildBillingParams — subject construction
// ---------------------------------------------------------------------------

describe("buildBillingParams", () => {
  it("returns internal user subject when no accountId", () => {
    const result = buildBillingParams({ feature: "graph" });
    expect(result.user).toBe("internal:internal:test-app:graph");
  });

  it("returns company user subject when accountId is provided", () => {
    const result = buildBillingParams({
      feature: "graph",
      accountId: 42,
      brandId: 7,
    });
    expect(result.user).toBe("company:42:brand:7");
  });

  it("defaults brandId to 'default' when only accountId is provided", () => {
    const result = buildBillingParams({
      feature: "graph",
      accountId: 42,
    });
    expect(result.user).toBe("company:42:brand:default");
  });

  it("accepts string accountId and brandId", () => {
    const result = buildBillingParams({
      feature: "graph",
      accountId: "comp-abc",
      brandId: "ws-xyz",
    });
    expect(result.user).toBe("company:comp-abc:brand:ws-xyz");
  });

  it("uses APP_PRODUCT and APP_NAME in internal subject", () => {
    setEnv({ APP_NAME: "my-cool-app", APP_PRODUCT: "fashion" });
    const result = buildBillingParams({ feature: "trend-analysis" });
    expect(result.user).toBe("internal:fashion:my-cool-app:trend-analysis");
  });
});

// ---------------------------------------------------------------------------
// buildBillingParams — metadata structure
// ---------------------------------------------------------------------------

describe("buildBillingParams metadata", () => {
  it("includes spend_logs_metadata with required fields", () => {
    const result = buildBillingParams({ feature: "graph" });
    const slm = result.metadata.spend_logs_metadata;
    expect(slm.app).toBe("test-app");
    expect(slm.feature).toBe("graph");
    expect(slm.environment).toBeDefined();
    expect(slm.user).toBe("internal:internal:test-app:graph");
  });

  it("user field in metadata matches top-level user", () => {
    const internal = buildBillingParams({ feature: "graph" });
    expect(internal.metadata.spend_logs_metadata.user).toBe(internal.user);
    expect(internal.metadata.user).toBe(internal.user);

    const customer = buildBillingParams({
      feature: "graph",
      accountId: 1,
      brandId: 2,
    });
    expect(customer.metadata.spend_logs_metadata.user).toBe(customer.user);
    expect(customer.metadata.user).toBe(customer.user);
  });

  it("includes company_id and brand_id in metadata when provided", () => {
    const result = buildBillingParams({
      feature: "graph",
      accountId: 42,
      brandId: 7,
    });
    const slm = result.metadata.spend_logs_metadata;
    expect(slm.company_id).toBe("42");
    expect(slm.brand_id).toBe("7");
  });

  it("omits company_id and brand_id from metadata when not provided", () => {
    const result = buildBillingParams({ feature: "graph" });
    const slm = result.metadata.spend_logs_metadata;
    expect(slm).not.toHaveProperty("company_id");
    expect(slm).not.toHaveProperty("brand_id");
  });
});

// ---------------------------------------------------------------------------
// buildBillingParams — environment
// ---------------------------------------------------------------------------

describe("buildBillingParams environment", () => {
  it("prefers NEXT_PUBLIC_ENVIRONMENT over NODE_ENV", () => {
    setEnv({
      NEXT_PUBLIC_ENVIRONMENT: "staging",
      NODE_ENV: "production",
    });
    const result = buildBillingParams({ feature: "graph" });
    expect(result.metadata.spend_logs_metadata.environment).toBe("staging");
  });

  it("falls back to NODE_ENV when NEXT_PUBLIC_ENVIRONMENT is unset", () => {
    setEnv({
      NEXT_PUBLIC_ENVIRONMENT: undefined,
      NODE_ENV: "production",
    });
    const result = buildBillingParams({ feature: "graph" });
    expect(result.metadata.spend_logs_metadata.environment).toBe("production");
  });

  it("defaults environment to 'development' when both env vars are unset", () => {
    setEnv({
      NEXT_PUBLIC_ENVIRONMENT: undefined,
      NODE_ENV: undefined,
    });
    const result = buildBillingParams({ feature: "graph" });
    expect(result.metadata.spend_logs_metadata.environment).toBe("development");
  });
});

// ---------------------------------------------------------------------------
// buildBillingParams — validation
// ---------------------------------------------------------------------------

describe("buildBillingParams validation", () => {
  it("throws when APP_NAME is missing", () => {
    setEnv({ APP_NAME: undefined });
    expect(() => buildBillingParams({ feature: "graph" })).toThrow(
      "APP_NAME environment variable is required",
    );
  });

  it("throws when APP_PRODUCT is missing", () => {
    setEnv({ APP_PRODUCT: undefined });
    expect(() => buildBillingParams({ feature: "graph" })).toThrow(
      "APP_PRODUCT environment variable is required",
    );
  });

  it("logs warning for unrecognized APP_PRODUCT", () => {
    setEnv({ APP_PRODUCT: "fashin" });
    buildBillingParams({ feature: "graph" });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("APP_PRODUCT 'fashin' is not a recognized"),
    );
  });

  it("does not warn for recognized products", () => {
    for (const product of ["fashion", "engage", "intelligence", "internal"]) {
      _resetProductWarning();
      (logger.warn as jest.Mock).mockClear();
      setEnv({ APP_PRODUCT: product });
      buildBillingParams({ feature: "graph" });
      expect(logger.warn).not.toHaveBeenCalled();
    }
  });

  it("only logs the product warning once", () => {
    setEnv({ APP_PRODUCT: "typo" });
    buildBillingParams({ feature: "a" });
    buildBillingParams({ feature: "b" });
    buildBillingParams({ feature: "c" });
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

describe("llmCompletion usage monitoring", () => {
  it("records non-streaming response usage with the same billing feature", async () => {
    mockCreate.mockResolvedValueOnce({
      id: "completion-1",
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
      _request_id: "request-1",
    });

    await llmCompletion({
      model: "openai/gpt-5.4-mini",
      feature: "synthetic-catalog-product-generation",
      messages: [{ role: "user", content: "Generate" }],
    });

    expect(mockRecordLLMUsage).toHaveBeenCalledWith({
      requestId: "request-1",
      feature: "synthetic-catalog-product-generation",
      model: "openai/gpt-5.4-mini",
      operation: "CHAT_COMPLETION",
      usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
    });
  });
});

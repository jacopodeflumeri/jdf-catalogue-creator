/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- the prefix tests below
 * re-import keygen after jest.resetModules() to exercise its module-init-time
 * read of config.app.environment. `import` cannot express this: ESM imports are
 * hoisted and cached, so they would bind the module once, before the per-test
 * jest.mock() calls take effect. require() after resetModules is the idiom. */

/**
 * Tests for API key generation
 *
 * Verifies:
 * 1. Key format: {prefix}_{64_hex_chars}
 * 2. Environment prefix mapping
 * 3. Key uniqueness
 */

jest.mock("@/config", () => ({
  config: {
    app: {
      environment: "staging",
    },
  },
}));

import { generateApiKey } from "../keygen";

describe("generateApiKey", () => {
  it("generates key with correct environment prefix", () => {
    const { key, environment } = generateApiKey();

    expect(key).toMatch(/^stg_/);
    expect(environment).toBe("staging");
  });

  it("generates 64-char hex string after prefix", () => {
    const { key } = generateApiKey();
    const hex = key.split("_")[1];

    expect(hex).toHaveLength(64);
    expect(hex).toMatch(/^[0-9a-f]+$/);
  });

  it("generates unique keys", () => {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      keys.add(generateApiKey().key);
    }

    expect(keys.size).toBe(100);
  });
});

// Test other environment prefixes
describe("generateApiKey environment prefixes", () => {
  it("uses dev_ prefix for development", () => {
    jest.resetModules();
    jest.mock("@/config", () => ({
      config: { app: { environment: "development" } },
    }));

    const { generateApiKey: genKey } = require("../keygen");
    const { key } = genKey();

    expect(key).toMatch(/^dev_/);
  });

  it("uses prod_ prefix for production", () => {
    jest.resetModules();
    jest.mock("@/config", () => ({
      config: { app: { environment: "production" } },
    }));

    const { generateApiKey: genKey } = require("../keygen");
    const { key } = genKey();

    expect(key).toMatch(/^prod_/);
  });

  it("defaults to dev_ for unknown environment", () => {
    jest.resetModules();
    jest.mock("@/config", () => ({
      config: { app: { environment: undefined } },
    }));

    const { generateApiKey: genKey } = require("../keygen");
    const { key } = genKey();

    expect(key).toMatch(/^dev_/);
  });
});

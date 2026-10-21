/** @jest-environment node */

/**
 * Tests for the CDK environment configuration.
 *
 * Guards the cost-allocation plumbing: `product` (and the other app-identity
 * fields) must flow from app.config.json into every EnvironmentConfig, since
 * the `Product` AWS tag and the container's APP_PRODUCT both read it.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { getEnvironmentConfig } from "../environments";

// Read the same single source of truth the config module reads.
const appConfig = JSON.parse(
  readFileSync(resolve(__dirname, "../../../../app.config.json"), "utf-8"),
);
const expectedProduct: string = appConfig.product || "internal";

describe("getEnvironmentConfig", () => {
  it.each(["staging", "production"])(
    "plumbs the product line from app.config.json into %s",
    (env) => {
      expect(getEnvironmentConfig(env).product).toBe(expectedProduct);
    },
  );

  it("uses the same product line across environments (it's a per-app rollup)", () => {
    expect(getEnvironmentConfig("staging").product).toBe(
      getEnvironmentConfig("production").product,
    );
  });

  it.each(["staging", "production"])(
    "carries a non-empty product and the configured appName for %s",
    (env) => {
      const config = getEnvironmentConfig(env);
      expect(config.product).toBeTruthy();
      expect(config.appName).toBe(appConfig.appName);
    },
  );

  it("throws on an unknown environment", () => {
    expect(() => getEnvironmentConfig("bogus")).toThrow(/Unknown environment/);
  });
});

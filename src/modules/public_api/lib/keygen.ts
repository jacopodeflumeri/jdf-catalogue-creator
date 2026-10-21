/**
 * API Key Generator
 *
 * Generates environment-prefixed API keys.
 */

import crypto from "crypto";
import { config } from "@/config";

const ENV_PREFIXES: Record<string, string> = {
  development: "dev",
  staging: "stg",
  production: "prod",
};

export function generateApiKey(): { key: string; environment: string } {
  const environment = config.app.environment ?? "development";
  const prefix = ENV_PREFIXES[environment] ?? "dev";
  const random = crypto.randomBytes(32).toString("hex");
  return { key: `${prefix}_${random}`, environment };
}

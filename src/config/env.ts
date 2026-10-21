/**
 * Environment Variable Validation
 * Centralized environment variable management with runtime validation
 */

import { z } from 'zod';

// Build DATABASE_URL from DB_* env vars if it isn't set explicitly. Mirrors
// prisma.config.ts, prisma/seed.ts, and src/lib/prisma/client.ts so the same
// derived URL is used everywhere. This runs before the Zod schema is parsed,
// so DATABASE_URL is always populated by the time validation happens.
if (!process.env.DATABASE_URL && process.env.DB_NAME) {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const user = process.env.DB_USER || 'postgres';
  const password = encodeURIComponent(process.env.DB_PASSWORD || '');
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${process.env.DB_NAME}`;
}

/**
 * Environment variable schema with validation rules
 */
const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Application
  APP_NAME: z.string().default('Mapp Labs'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // Authentication
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  NEXTAUTH_URL: z.string().url(),

  // Magic-link customer auth (OPTIONAL capability, OFF by default).
  MAGIC_LINK_ENABLED: z.string().optional().transform(val => val === 'true'),
  MAGIC_LINK_EXPIRY: z.string().default('3600').transform(Number),

  // Keycloak — IdP hints / TLS (optional; only used when KEYCLOAK_ENABLED=true)
  KEYCLOAK_IDP_HINT: z.string().optional(),
  KEYCLOAK_COMPANY_IDP_HINT: z.string().optional(),
  KEYCLOAK_CA_PEM: z.string().optional(),
  KEYCLOAK_TLS_INSECURE: z.string().optional().transform(val => val === 'true'),

  // Company Login capability (default ON). Set COMPANY_LOGIN_ENABLED=false for a
  // Mapp-INTERNAL-ONLY app: external Mapp Cloud customers can no longer sign in
  // with company context (the customer signIn fork is rejected, and the admin
  // Company Users views are hidden). Leave unset/true to allow company-context
  // customers in addition to internal Mapp admins.
  COMPANY_LOGIN_ENABLED: z.string().optional().transform(val => val !== 'false'),

  // Dev auth bypass — local fallback when a developer has no AWS/Keycloak
  // access. Only honored when NODE_ENV !== 'production' (enforced in config +
  // provider). Lets you test the full login/eligibility matrix offline.
  DEV_AUTH_ENABLED: z.string().optional().transform(val => val === 'true'),

  // Gate for /admin/auth-debug and /admin/ldap-groups-example (off by default in production).
  AUTH_DEBUG_ENABLED: z.string().optional().transform(val => val === 'true'),

  // Super Admins (comma-separated emails)
  SUPER_ADMINS: z.string().optional(),

  // Admin Security
  ADMIN_ALLOWED_IPS: z.string().optional(),
  ADMIN_SUPERADMIN_ONLY: z.string().optional().transform(val => val === 'true'),
  ADMIN_ENABLE_IP_CHECK: z.string().optional().transform(val => val === 'true'),

  // Azure AD — legacy direct-Entra path. Optional once KEYCLOAK_ENABLED=true
  // (the "Mapp Entra ID" KC button brokers to Entra). The superRefine below
  // requires EITHER full Azure OR full Keycloak OR dev-auth so internal login
  // is always possible.
  AZURE_AD_CLIENT_ID: z.string().optional(),
  AZURE_AD_CLIENT_SECRET: z.string().optional(),
  AZURE_AD_TENANT_ID: z.string().optional(),

  // Keycloak — internal login broker (preferred path)
  KEYCLOAK_ENABLED: z.string().optional().transform(val => val === 'true'),
  KEYCLOAK_ISSUER: z.string().url().optional(),
  KEYCLOAK_CLIENT_ID: z.string().optional(),
  KEYCLOAK_CLIENT_SECRET: z.string().optional(),
  
  // AWS S3 (Optional - will disable S3 features if not provided)
  S3_REGION: z.string().optional(),
  S3_BUCKET_NAME: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_MAX_FILE_SIZE: z.string().default('10').transform(Number),
  
  // CloudFront (Optional)
  CLOUDFRONT_DOMAIN: z.string().optional(),
  
  // Mapp Engage
  ENGAGE_BASE_URL: z.string().url().optional(),
  ENGAGE_AUTH_TOKEN: z.string().optional(),
  NEXT_PUBLIC_ENGAGE_GROUP_ID: z.string().optional(),
  NEXT_PUBLIC_ENGAGE_MESSAGE_ID: z.string().optional(),
  
  // SFTP
  SFTP_HOST: z.string().optional(),
  SFTP_PORT: z.string().optional().transform(val => val ? Number(val) : 22),
  SFTP_USERNAME: z.string().optional(),
  SFTP_PASSWORD: z.string().optional(),
  SFTP_PRIVATE_KEY: z.string().optional(),
  SFTP_PASSPHRASE: z.string().optional(),
  SFTP_ROOT_PATH: z.string().optional().default('/'),
  /** SHA-256 host key fingerprint, as printed by `ssh-keyscan -t ed25519 <host>
   *  | ssh-keygen -lf -` (the `SHA256:...` field). Required unless
   *  SFTP_ALLOW_UNKNOWN_HOST_KEY is set — without it the client accepts ANY
   *  host key, which is a MITM path to the service account credential. */
  SFTP_HOST_FINGERPRINT: z.string().optional(),
  /** Escape hatch for local development against a throwaway server. Refused in
   *  production by getSFTPConfig(). */
  SFTP_ALLOW_UNKNOWN_HOST_KEY: z
    .string()
    .optional()
    .transform(val => val === 'true'),
  /** Drop the per-app directory component from the SFTP root. Only for
   *  counterparties that dictate their own layout — you then owe a server-side
   *  chroot. See docs/template/capabilities/SFTP.md. */
  SFTP_DISABLE_APP_PREFIX: z
    .string()
    .optional()
    .transform(val => val === 'true'),
  /** Max bytes for a single download or upload. Default 25MB — the whole file
   *  is held in memory, so this protects the task from OOM. */
  SFTP_MAX_FILE_BYTES: z
    .string()
    .optional()
    .transform(val => (val ? Number(val) : 25 * 1024 * 1024)),
  
  // Feature Flags
  ENABLE_SOURCE_MAPS: z.string().optional().transform(val => val === 'true'),
  
  // Security
  ALLOWED_ORIGINS: z.string().optional(),

  // LLM (LiteLLM Proxy)
  LITELLM_API_KEY: z.string().optional(),
  LITELLM_BASE_URL: z.string().url().optional(),
  APP_PRODUCT: z.string().optional(),
}).superRefine((value, ctx) => {
  const hasAzureConfig = Boolean(
    value.AZURE_AD_CLIENT_ID && value.AZURE_AD_CLIENT_SECRET && value.AZURE_AD_TENANT_ID
  );
  const hasKeycloakConfig = Boolean(
    value.KEYCLOAK_ENABLED && value.KEYCLOAK_ISSUER && value.KEYCLOAK_CLIENT_ID && value.KEYCLOAK_CLIENT_SECRET
  );
  // The dev bypass is a valid local-only login path (no AWS/KC needed).
  const hasDevAuth = Boolean(
    value.DEV_AUTH_ENABLED && value.NODE_ENV !== 'production'
  );

  if (!hasAzureConfig && !hasKeycloakConfig && !hasDevAuth) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['AZURE_AD_CLIENT_ID'],
      message:
        'Provide internal login config: full Azure AD (AZURE_AD_CLIENT_ID/SECRET/TENANT_ID), or full Keycloak (KEYCLOAK_ENABLED + KEYCLOAK_ISSUER/CLIENT_ID/CLIENT_SECRET), or set DEV_AUTH_ENABLED=true for local dev',
    });
  }
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validated environment variables
 * This will throw an error at startup if validation fails
 * Only validates on the server side (not in browser)
 */
let env: Env;

// Only validate environment on server side
if (typeof window === 'undefined') {
  try {
    env = envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map(issue => 
        `  - ${issue.path.join('.')}: ${issue.message}`
      ).join('\n');
      
      console.error('❌ Environment validation failed:\n' + errorMessages);
      throw new Error(`Invalid environment variables:\n${errorMessages}`);
    }
    throw error;
  }
} else {
  // Client-side: create a minimal env object with public variables only
  env = {
    NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
    NEXT_PUBLIC_ENGAGE_GROUP_ID: process.env.NEXT_PUBLIC_ENGAGE_GROUP_ID,
    NEXT_PUBLIC_ENGAGE_MESSAGE_ID: process.env.NEXT_PUBLIC_ENGAGE_MESSAGE_ID,
  } as Env;
}

export { env };

/**
 * Runtime validation helper for specific environment checks
 * Useful for validating optional features
 */
export function validateEnv(): { valid: boolean; errors?: string[] } {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      )
    };
  }
  
  return { valid: true };
}

/**
 * Check if a specific feature is enabled based on environment
 */
export function isFeatureEnabled(feature: keyof typeof featureFlags): boolean {
  return featureFlags[feature] ?? false;
}

/**
 * Feature flags derived from environment
 */
export const featureFlags = {
  sourceMaps: env.ENABLE_SOURCE_MAPS,
  mappEngage: !!(env.ENGAGE_BASE_URL && env.ENGAGE_AUTH_TOKEN),
  cdn: !!env.CLOUDFRONT_DOMAIN,
  // Reflects whether SFTP is actually usable, not just partially configured:
  // getSFTPConfig() refuses to connect without a host key policy.
  sftp: !!(
    env.SFTP_HOST &&
    env.SFTP_USERNAME &&
    (env.SFTP_PASSWORD || env.SFTP_PRIVATE_KEY) &&
    (env.SFTP_HOST_FINGERPRINT || env.SFTP_ALLOW_UNKNOWN_HOST_KEY)
  ),
  // ECS uses the task-role credential provider. Static keys are optional and
  // only useful for local setups that do not already have an AWS credential
  // chain configured.
  s3: !!(env.S3_REGION && env.S3_BUCKET_NAME),
  llm: !!(env.LITELLM_API_KEY && env.LITELLM_BASE_URL),
} as const;

/**
 * Get environment-specific configuration
 */
export function getEnvironmentInfo() {
  return {
    nodeEnv: env.NODE_ENV,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    appUrl: env.APP_URL,
    appName: env.APP_NAME,
    features: featureFlags,
  };
}

// Application Configuration
// Note: For server-side env validation, import { env } from './env' in your server code
export const config = {
  // Application Info
  app: {
    name:
      process.env.APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || "Mapp Labs",
    url:
      process.env.APP_URL ||
      (typeof window === "undefined"
        ? "http://localhost:3000"
        : window.location.origin),
    isDevelopment: process.env.NODE_ENV === "development",
    isProduction: process.env.NODE_ENV === "production",
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT as
      | "development"
      | "staging"
      | "production"
      | undefined,
    version: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
    commit: process.env.NEXT_PUBLIC_BUILD_COMMIT || "local",
  },

  // Authentication Settings
  auth: {
    secret: process.env["NEXTAUTH_SECRET"],
    // Magic-link expiry lives on config.magicLink.expirySeconds (single source).
    sessionMaxAge: 3 * 30 * 24 * 60 * 60, // 3 months in seconds
    superAdmins: process.env["SUPER_ADMINS"]
      ? process.env["SUPER_ADMINS"]
          .split(",")
          .map((email: string) => email.trim())
      : [],
    // Security restrictions (easily configurable via environment variables)
    restrictions: {
      // IP whitelist for admin access (comma-separated IPs, empty means no restriction)
      allowedIPs: process.env["ADMIN_ALLOWED_IPS"]
        ? process.env["ADMIN_ALLOWED_IPS"]
            .split(",")
            .map((ip) => ip.trim())
            .filter((ip) => ip)
        : [],
      // Force superadmin-only access (set to 'true' to restrict to superadmins only)
      superAdminOnly: process.env["ADMIN_SUPERADMIN_ONLY"] === "true",
      // Enable IP checking (set to 'false' to disable IP restrictions)
      enableIpCheck: process.env["ADMIN_ENABLE_IP_CHECK"] === "true",
    },
  },

  // Azure AD Configuration (legacy direct-Entra path — optional once Keycloak
  // is enabled, since the "Mapp Entra ID" KC button brokers to Entra)
  azure: {
    clientId: process.env.AZURE_AD_CLIENT_ID || "",
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET || "",
    tenantId: process.env.AZURE_AD_TENANT_ID || "",
    authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || ""}`,
  },

  // Magic-link customer auth (OPTIONAL capability, OFF by default).
  // The template serves apps that may have non-company users; magic-link is the
  // legacy email-link customer path, kept cleanly separated from the Keycloak
  // path. Enable per-app with MAGIC_LINK_ENABLED=true. Apps with no
  // non-company users can leave it off or remove it.
  magicLink: {
    enabled: process.env.MAGIC_LINK_ENABLED === "true",
    expirySeconds: parseInt(process.env["MAGIC_LINK_EXPIRY"] || "3600", 10),
  },

  // Dev auth bypass — local fallback when a developer has no AWS/Keycloak
  // access. DOUBLE-GATED: requires DEV_AUTH_ENABLED=true AND a non-production
  // NODE_ENV. Never active in a production build. Mocks the IdP only — the real
  // signIn hydration + eligibility code still runs.
  devAuth: {
    enabled:
      process.env.DEV_AUTH_ENABLED === "true" &&
      process.env.NODE_ENV !== "production",
  },

  // Admin developer pages (/admin/auth-debug — a read-only session/claims
  // inspector — and /admin/ldap-groups-example). On by default outside
  // production; in production they require the explicit AUTH_DEBUG_ENABLED=true
  // flag (still admin-gated either way).
  authDebug: {
    enabled:
      process.env.AUTH_DEBUG_ENABLED === "true" ||
      process.env.NODE_ENV !== "production",
  },

  // Company Login capability (default ON, opt-out for Mapp-internal-only apps).
  // When disabled, the company-context CUSTOMER login path is refused and the
  // admin Company Users views are hidden — the app serves Mapp employees only.
  // This is the user-facing "internal-only vs external-company-users" switch,
  // listed as the `company_login` capability in app.config.json.
  companyLogin: {
    enabled: process.env.COMPANY_LOGIN_ENABLED !== "false",
  },

  // "View as customer" capability (OPTIONAL, default OFF) — an admin previews
  // a company's customer pages as its Company-Login customers see them. Needs
  // Company Login, so it is off whenever that is. See
  // docs/template/capabilities/CUSTOMER_PREVIEW.md.
  customerPreview: {
    enabled:
      process.env.CUSTOMER_PREVIEW_ENABLED === "true" &&
      process.env.COMPANY_LOGIN_ENABLED !== "false",
    // Service codes granted on every previewed workspace — the codes your
    // eligibility policy reads from `session.user.workspaces[].services`
    // (Keycloak claim codes, NOT client-catalog service names). Empty is
    // right only for the template's allow-all policy.
    services: (process.env.CUSTOMER_PREVIEW_SERVICES ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },

  // Keycloak Configuration
  keycloak: {
    enabled: process.env.KEYCLOAK_ENABLED === "true",
    issuer: process.env.KEYCLOAK_ISSUER || "",
    clientId: process.env.KEYCLOAK_CLIENT_ID || "",
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || "",
    // Trim whitespace before defaulting: SSM SecureString won't accept an
    // empty value, so we use ' ' as a placeholder when company-idp-hint isn't
    // configured yet — must treat that as empty (button hidden), not truthy.
    idpHint: (process.env.KEYCLOAK_IDP_HINT || "").trim(),
    companyIdpHint: (process.env.KEYCLOAK_COMPANY_IDP_HINT || "").trim(),
    caPem: process.env.KEYCLOAK_CA_PEM || "",
    // TLS-insecure is an emergency escape hatch for staging/INT backchannels
    // with a non-public CA. HARD-GATED OFF in production: a real cert + CA
    // bundle is mandatory there, never `rejectUnauthorized:false`.
    tlsInsecure:
      process.env.KEYCLOAK_TLS_INSECURE === "true" &&
      process.env.NODE_ENV !== "production",
  },

  // Build and Development Configuration
  build: {
    s3: {
      bucketNameImages: process.env.S3_BUCKET_NAME || "",
      region: process.env.S3_REGION || "",
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      maxFileSize: parseInt(process.env.S3_MAX_FILE_SIZE || "10") * 1024 * 1024, // Convert to bytes
    },
  },

  // CSRF Protection Configuration
  security: {
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
          .map((origin) => origin.trim())
          .filter((origin) => origin)
      : [],
  },

  // UI Configuration
  ui: {
    theme: {
      primary: "#8D77F7", // Mapp Primary Purple
      secondary: "#7FF4E0", // Mapp Secondary Teal
      background: "#F1ECE3", // Mapp Background Cream
      success: "#10B981", // Emerald-500
      warning: "#F59E0B", // Amber-500
      error: "#EF4444", // Red-500
      info: "#06B6D4", // Cyan-500
      purple: "#8B5CF6", // Violet-500
      green: "#84CC16", // Lime-500
      orange: "#F97316", // Orange-500
      pink: "#EC4899", // Pink-500
    },
    chartColours: [
      "#3B82F6",
      "#10B981",
      "#F59E0B",
      "#EF4444",
      "#8B5CF6",
      "#06B6D4",
      "#84CC16",
      "#F97316",
      "#EC4899",
      "#6B7280",
    ],
    // Navigation config moved to @/modules/navigation/config/navigation-items.tsx
  },
};

// Type definitions for configuration
export type Config = typeof config;
// NavigationItem type moved to @/modules/navigation/types

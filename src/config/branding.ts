import "server-only";
import appConfig from "../../app.config.json";
import type { AppBranding } from "@/components/shared/layout/AppBranding";

export function getAppBranding(): AppBranding {
  const appName = process.env.APP_NAME?.trim();
  // ECS uses APP_NAME as the resource/billing slug. Prefer the display name in
  // that case, while preserving human-readable APP_NAME overrides in local dev.
  const name = process.env.APP_DISPLAY_NAME?.trim()
    || (appName !== appConfig.appName ? appName : undefined)
    || appConfig.displayName?.trim()
    || appName
    || "Mapp Labs";
  const logoPath = (appConfig as { logoPath?: string }).logoPath?.trim();

  return {
    name,
    // Logos are app-owned assets in public/, never remote tracking URLs.
    logoPath: logoPath?.startsWith("/") && !logoPath.startsWith("//") && !logoPath.includes("\\")
      ? logoPath : undefined,
  };
}

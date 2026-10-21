import { getAppBranding } from "@/config/branding";

export function pageTitle(pageName: string): string {
  return `${pageName} - ${getAppBranding().name}`;
}

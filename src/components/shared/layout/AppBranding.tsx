"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export interface AppBranding {
  name: string;
  logoPath?: string;
}

const BrandingContext = createContext<AppBranding>({ name: "Mapp Labs" });

// Only these public fields cross the server/client boundary.
export function AppBrandingProvider({
  branding,
  children,
}: {
  branding: AppBranding;
  children: ReactNode;
}) {
  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export function useAppBranding() {
  return useContext(BrandingContext);
}

/** Shared identity for navigation. The name remains visible alongside a logo. */
export default function AppIdentity({ compact = false }: { compact?: boolean }) {
  const { name, logoPath } = useAppBranding();
  const [failedLogo, setFailedLogo] = useState<string>();
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase();

  return (
    <span className="flex min-w-0 items-center gap-3" title={name}>
      {logoPath && failedLogo !== logoPath ? (
        <img
          src={logoPath}
          alt=""
          className="h-8 w-8 shrink-0 object-contain"
          onError={() => setFailedLogo(logoPath)}
        />
      ) : compact ? (
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-sm font-semibold text-primary-800">
          {initials}
        </span>
      ) : null}
      <span className={compact ? "sr-only" : "min-w-0 break-words text-sm font-semibold leading-tight text-[#1a1a1a]"}>
        {name}
      </span>
    </span>
  );
}

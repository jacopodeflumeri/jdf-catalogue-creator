"use client";

import React from "react";
import Badge from "@/components/ui/Badge";

type PillMode = "pill" | "dot";
type BadgeVariant =
  | "primary"
  | "primarydark"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "purple"
  | "blue"
  | "gray"
  | "outline";

interface EnvironmentLabsPillProps {
  environment?: string;
  mode?: PillMode;
  className?: string;
}

interface PillConfig {
  label: string;
  variant: BadgeVariant;
  showDot: boolean;
}

const DEFAULT_PILL: PillConfig = {
  label: "Labs",
  variant: "primary",
  showDot: false,
};

const NON_PROD_PILLS: Record<"development" | "staging", PillConfig> = {
  development: {
    label: "DEVELOPMENT",
    variant: "warning",
    showDot: true,
  },
  staging: {
    label: "STAGING",
    variant: "blue",
    showDot: true,
  },
};

function resolvePillConfig(environment?: string): PillConfig {
  const normalized = environment?.trim().toLowerCase();

  if (!normalized || normalized === "production") {
    return DEFAULT_PILL;
  }

  return NON_PROD_PILLS[normalized as keyof typeof NON_PROD_PILLS] ?? DEFAULT_PILL;
}

const EnvironmentLabsPill: React.FC<EnvironmentLabsPillProps> = ({
  environment,
  mode = "pill",
  className = "",
}) => {
  const pill = resolvePillConfig(environment);

  if (mode === "dot") {
    if (!pill.showDot) {
      return null;
    }

    return (
      <span
        className={`inline-flex h-2.5 w-2.5 rounded-full border border-white/85 ${className}`}
        style={{ backgroundColor: pill.variant === "warning" ? "rgba(216,162,74,0.95)" : "rgba(77,139,201,0.95)" }}
        data-testid="environment-labs-dot"
      >
        <span className="sr-only">Environment: {pill.label}</span>
      </span>
    );
  }

  return (
    <Badge
      className={className}
      variant={pill.variant}
      size="sm"
      aria-label={`Environment: ${pill.label}`}
      data-testid="environment-labs-pill"
    >
      {pill.label}
    </Badge>
  );
};

export default EnvironmentLabsPill;

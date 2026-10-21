"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import logger from "@/lib/utils/logger";
import { resolveCallbackUrl } from "@/modules/auth/lib/callback-url";

type Role = "admin" | "customer";

export default function DevLoginClient() {
  const [role, setRole] = useState<Role>("customer");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");
  // Optional sample workspace so app-specific eligibility policies have a
  // `services` entitlement to read. Edit the codes for your app's needs.
  const [attachWorkspace, setAttachWorkspace] = useState(true);
  const [services, setServices] = useState("Q3V2");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    const workspaces =
      role === "customer" && attachWorkspace
        ? JSON.stringify([
            {
              workspaceId: "1",
              services: services
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            },
          ])
        : JSON.stringify([]);

    try {
      // For a CredentialsProvider the fields go in the OPTIONS (2nd) arg so
      // they're sent as the POST body and reach authorize() as `credentials`.
      await signIn("dev-login", {
        // Back to the page that sent the visitor to sign in, when it is in
        // the area this role lands in (same-origin only); else the area root.
        callbackUrl: resolveCallbackUrl(
          new URLSearchParams(window.location.search).get("callbackUrl"),
          role === "admin" ? "admin" : "account",
          window.location.origin,
        ),
        role,
        email,
        name,
        companyId,
        userId,
        workspaces,
      });
    } catch (error) {
      logger.error("Dev login failed:", error);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-6 animate-fade-in">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-[rgba(216,162,74,0.18)] border border-white/75">
            <Icon type="lightning" className="text-[#7D581C]" size="lg" />
          </div>
          <h2 className="mt-4 font-extrabold text-3xl tracking-tight text-[#1a1a1a]">
            Developer Login
          </h2>
          <p className="mt-2 text-sm text-[#1a1a1a]/60">
            Local-only mock login. No AWS or Keycloak needed. Runs the real
            session hydration + eligibility code.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-surface rounded-xl p-6 space-y-4"
        >
          {/* Role */}
          <div>
            <span className="block text-sm font-medium text-[#1a1a1a]/80 mb-1.5">
              Sign in as
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(["customer", "admin"] as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold capitalize transition-all ${
                    role === r
                      ? "border-primary/60 bg-[rgba(141,119,247,0.14)] text-primary"
                      : "border-white/85 bg-[rgba(255,255,255,0.5)] text-[#1a1a1a]/70"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <Field label="Email" value={email} onChange={setEmail} placeholder={role === "admin" ? "dev-admin@mapp.com" : "dev-customer@example.com"} />
          <Field label="Name" value={name} onChange={setName} placeholder="Dev User" />

          {role === "customer" && (
            <>
              <Field
                label="Company ID (client-catalog company id)"
                value={companyId}
                onChange={setCompanyId}
                placeholder="e.g. 226 (must map to a local Account to see context)"
              />
              <Field
                label="Mapp Cloud User ID (optional)"
                value={userId}
                onChange={setUserId}
                placeholder="defaults to dev-<email>"
              />
              <label className="flex items-center gap-2 text-sm text-[#1a1a1a]/80">
                <input
                  type="checkbox"
                  checked={attachWorkspace}
                  onChange={(e) => setAttachWorkspace(e.target.checked)}
                  className="h-4 w-4 accent-[#8D77F7]"
                />
                Attach a sample workspace with entitlements
              </label>
              {attachWorkspace && (
                <Field
                  label="Workspace services (comma-separated)"
                  value={services}
                  onChange={setServices}
                  placeholder="e.g. Q3V2, FASHION_API"
                />
              )}
            </>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full flex items-center justify-center"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Sign in (dev)"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-[#1a1a1a]/80 mb-1">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="w-full rounded-xl border border-white/85 bg-[rgba(255,255,255,0.58)] px-3 py-2 text-sm text-[#1a1a1a] outline-none transition-all focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

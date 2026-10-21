import { notFound } from "next/navigation";
import { config } from "@/config";
import DevLoginClient from "./DevLoginClient";

// Read the flag at request time; 404 entirely in production so the route
// doesn't exist there. In local dev, if the flag is off, show how to turn it on.
export const dynamic = "force-dynamic";

export default function DevLoginPage() {
  if (config.devAuth.enabled) {
    return <DevLoginClient />;
  }

  // Hard 404 outside local development.
  if (!config.app.isDevelopment) {
    notFound();
  }

  // Local dev, but the flag isn't set — give an actionable hint.
  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center space-y-3 animate-fade-in">
        <h1 className="font-extrabold text-2xl tracking-tight text-[#1a1a1a]">
          Developer login is disabled
        </h1>
        <p className="text-sm text-[#1a1a1a]/65">
          Add <code className="px-1 rounded bg-black/5">DEV_AUTH_ENABLED=true</code>{" "}
          to your <code className="px-1 rounded bg-black/5">.env</code> and restart
          the dev server to sign in locally without AWS or Keycloak.
        </p>
      </div>
    </div>
  );
}

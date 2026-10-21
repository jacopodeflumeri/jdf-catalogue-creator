"use client";

import { useEffect, Suspense } from "react";
import { signOut } from "next-auth/react";
import Loading from "@/components/ui/Loading";
import { useAppBranding } from "@/components/shared/layout/AppBranding";

type SignOutClientProps = {
  /** Keycloak end-session URL for federated logout, or null to just clear the app session. */
  endSessionUrl: string | null;
  /** Where to land when there's no federated logout to perform. */
  fallbackPath: string;
};

function SignOutContent({ endSessionUrl, fallbackPath }: SignOutClientProps) {
  const { name: appName } = useAppBranding();

  useEffect(() => {
    const handleSignOut = async () => {
      // 1) Clear the app's own NextAuth session cookie.
      await signOut({ redirect: false });
      // 2) End the upstream Keycloak/Entra SSO session too (federated logout),
      //    otherwise the next login is silently reused (no password prompt).
      //    KC redirects back to /auth/signout?kc=done → login page.
      if (endSessionUrl) {
        window.location.href = endSessionUrl;
      } else {
        window.location.href = fallbackPath;
      }
    };

    handleSignOut();
  }, [endSessionUrl, fallbackPath]);

  return (
    <div className="flex-1 flex flex-col justify-center py-12">
      <div className="max-w-md mx-auto w-full text-center animate-fade-in">
        <div className="mt-8">
          <Loading size="lg" text="" />
        </div>
        <h2 className="mt-6 font-extrabold text-4xl tracking-tight text-[#1a1a1a]">
          Signing out...
        </h2>
        <p className="mt-2 text-sm text-[#1a1a1a]/55">
          Please wait while we sign you out of {appName}
        </p>
      </div>
    </div>
  );
}

export default function SignOutClient(props: SignOutClientProps) {
  return (
    <Suspense fallback={<Loading />}>
      <SignOutContent {...props} />
    </Suspense>
  );
}

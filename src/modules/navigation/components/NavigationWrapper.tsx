/**
 * Navigation Wrapper Component
 *
 * Handles client-side mounting and search params for simple mode.
 * This wrapper ensures the navigation doesn't render until client-side hydration is complete.
 */

"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import NavigationComponent from "./Navigation";
import type { NavigationProps } from "../types";

export default function NavigationWrapper({
  className = "",
  customerAccount,
  navigationItems,
  inPage,
}: NavigationProps) {
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard: must detect client-side mount
    setMounted(true);
  }, []);

  const isSimpleMode = searchParams.get("simple") === "true";

  // Don't render until client-side mounted
  if (!mounted) {
    return null;
  }

  return (
    <NavigationComponent
      className={className}
      isSimpleMode={isSimpleMode}
      customerAccount={customerAccount}
      navigationItems={navigationItems}
      inPage={inPage}
    />
  );
}

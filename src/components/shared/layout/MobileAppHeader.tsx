"use client";

import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import AppIdentity from "./AppBranding";

export default function MobileAppHeader({ onOpen }: { onOpen: () => void }) {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-white/55 px-4 py-3 sm:hidden">
      <Button variant="ghost" size="sm" onClick={onOpen} aria-label="Open navigation">
        <Icon type="menu" size="md" />
      </Button>
      <AppIdentity />
    </header>
  );
}

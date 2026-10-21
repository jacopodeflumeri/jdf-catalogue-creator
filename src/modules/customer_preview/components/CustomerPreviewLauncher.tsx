"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/modal/Modal";
import {
  getCustomerPreviewOptionsAction,
  startCustomerPreviewAction,
} from "../server/actions";

export interface CustomerPreviewWorkspaceOption {
  /** Client-catalog workspace id. */
  id: number;
  name: string;
}

export interface CustomerPreviewLauncherProps {
  /**
   * REQUIRED, and computed on the server: `canStartCustomerPreview(session)`
   * from `@/modules/customer_preview/server`. False renders nothing — the
   * button is hidden (not disabled) for non-admins and when the capability is
   * off. In a server component, use `<CustomerPreviewLaunch>` instead, which
   * does this for you.
   */
  allowed: boolean;
  /** Client-catalog company id. */
  companyId: number;
  companyName?: string | null;
  /**
   * The company's workspaces when the page already has them. Omit on pages
   * that don't (e.g. a list of users) — they are loaded on click.
   */
  workspaces?: CustomerPreviewWorkspaceOption[];
  size?: "xs" | "sm";
  className?: string;
}

/**
 * The "View as customer" launch point. One workspace (or none) → a plain
 * button that previews the whole company; two or more → the button opens a
 * chooser: "Whole company" or "<workspace> only" (a real customer may be
 * granted just one workspace, and sees only it).
 *
 * The preview returns to the page it was started from (sanitised server-side
 * to an /admin path), with `?preview=exited|ended` — render
 * `<CustomerPreviewNotice status={searchParams.preview} />` on that page.
 */
export default function CustomerPreviewLauncher({
  allowed,
  companyId,
  companyName,
  workspaces,
  size = "xs",
  className = "",
}: CustomerPreviewLauncherProps) {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const [choices, setChoices] = useState<CustomerPreviewWorkspaceOption[] | null>(null);
  const [name, setName] = useState<string | null>(companyName ?? null);

  if (!allowed) return null;

  const start = (workspaceIds?: number[]) =>
    startTransition(() =>
      startCustomerPreviewAction({
        companyId,
        ...(workspaceIds ? { workspaceIds } : {}),
        returnTo: `${window.location.pathname}${window.location.search}`,
      }),
    );

  const open = async () => {
    let options = workspaces;
    if (options === undefined) {
      setIsLoading(true);
      try {
        const result = await getCustomerPreviewOptionsAction(companyId);
        // Not ok: start anyway, so the server refuses with a visible notice.
        options = result.ok ? result.workspaces : [];
        if (result.ok) setName(result.companyName);
      } finally {
        setIsLoading(false);
      }
    }
    if (options.length >= 2) setChoices(options);
    else start();
  };

  const busy = isPending || isLoading;

  return (
    <>
      <Button
        size={size}
        variant="outline"
        disabled={busy}
        loading={busy}
        onClick={open}
        className={className}
        title="See this company's customer pages as its customers do (read-only, 30 minutes, audited)"
      >
        <Icon type="eye" size="xs" className="mr-1" />
        View as customer
      </Button>

      <Modal
        isOpen={choices !== null}
        onClose={() => setChoices(null)}
        size="sm"
        title={`View ${name ?? "this company"} as a customer`}
        footer={
          <Button variant="ghost" size="sm" onClick={() => setChoices(null)} disabled={isPending}>
            Cancel
          </Button>
        }
      >
        <div className="space-y-2">
          <p className="pb-2 text-sm text-[#1a1a1a]/60">
            Read-only, for 30 minutes. Choose what the customer is granted.
          </p>
          <ChoiceButton
            title="Whole company"
            description="Every workspace — what a customer granted all of them sees"
            disabled={isPending}
            onClick={() => start()}
          />
          {(choices ?? []).map((w) => (
            <ChoiceButton
              key={w.id}
              title={`${w.name} only`}
              description="As a customer granted only this workspace"
              disabled={isPending}
              onClick={() => start([w.id])}
            />
          ))}
        </div>
      </Modal>
    </>
  );
}

function ChoiceButton({
  title,
  description,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="frost-button w-full rounded-xl px-4 py-3 text-left transition-all duration-300 hover:bg-white/75 disabled:opacity-60"
    >
      <span className="block text-sm font-semibold text-[#1a1a1a]">{title}</span>
      <span className="block text-xs text-[#1a1a1a]/55">{description}</span>
    </button>
  );
}

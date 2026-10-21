"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Loading from "@/components/ui/Loading";
import logger from "@/lib/utils/logger";

export default function AdminImpersonationBanner({
  type,
  variant,
}: {
  type?: "sidebar" | "banner";
  variant?: "desktop" | "mobile" | "tablet" | "collapsed";
}) {
  const { data: session, update } = useSession();
  const [isPending, startTransition] = useTransition();
  const [isExiting, setIsExiting] = useState(false);

  if (
    !session?.user?.role ||
    session?.user?.role !== "admin" ||
    !session?.user?.accountId
  ) {
    return null;
  }

  const accountName = session?.user?.accountName || "Customer";

  const handleExitAccountView = () => {
    setIsExiting(true);
    startTransition(async () => {
      try {
        logger.log("Admin exiting account view");

        // Clear accountId from admin session
        await update({ clearAccountId: true });

        logger.log("AccountId cleared, redirecting to admin");

        // Wait a bit for session to update, then redirect
        setTimeout(() => {
          window.location.href = "/admin";
        }, 300);
      } catch (error) {
        logger.error("Failed to exit account view:", error);
        setIsExiting(false);
      }
    });
  };

  return (
    <div
      className={`${type === "sidebar" ? "p-4" : ""} border-t border-white/55`}
    >
      <div
        className={`flex items-center justify-between gap-2 ${variant === "collapsed" ? "p-1.5" : "px-3 py-1.5"} bg-amber-50/80 border border-amber-200/60 rounded-xl backdrop-blur-sm`}
      >
        {variant === "collapsed" ? (
          <>
            <Icon type="eye" size="md" className="text-amber-600" />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 ">
              <Icon type="eye" size="sm" className="text-amber-600" />
              <span className="text-sm font-medium text-amber-700">
                {accountName}
              </span>
            </div>
            <Button
              variant="overrideNoBorder"
              size="xs"
              onClick={handleExitAccountView}
              disabled={isPending || isExiting}
              title="Exit Account View"
              className="hover:bg-amber-100 rounded-full p-1"
            >
              {isExiting ? (
                <Loading size="sm" text="" />
              ) : (
                <Icon
                  type="x"
                  size="sm"
                  className="text-amber-700 hover:text-amber-900"
                />
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
import { useToast } from "@/components/providers/ToastProvider";
import Icon from "@/components/ui/Icon";

const Toast: React.FC = () => {
  const { toasts, removeToast } = useToast();

  // Memoize the visible toasts to prevent unnecessary re-sorts
  const visibleToasts = useMemo(() => {
    return toasts
      .sort((a, b) => a.timestamp - b.timestamp) // Sort by timestamp (oldest first)
      .slice(-5); // Take the last 5 (most recent)
  }, [toasts]);

  // Memoize the remove function to prevent unnecessary re-renders
  const memoizedRemoveToast = React.useCallback(
    (id: string) => {
      removeToast(id);
    },
    [removeToast],
  );

  return (
    <div className="fixed bottom-4 right-4 z-90 flex flex-col gap-2 max-w-md">
      {visibleToasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={memoizedRemoveToast}
        />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: {
    id: string;
    message: string;
    type: "primary" | "success" | "error" | "warning" | "info";
    duration?: number;
    timestamp: number;
  };
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = React.memo(
  ({ toast, onRemove }) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);
    const remainingTimeRef = useRef<number>(toast.duration || 3000);
    const [isVisible, setIsVisible] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);

    const handleRemove = React.useCallback(() => {
      setIsRemoving(true);
      // Wait for fade-out animation to complete before actually removing
      setTimeout(() => {
        onRemove(toast.id);
      }, 300);
    }, [onRemove, toast.id]);

    useEffect(() => {
      // Slide in animation
      const slideInTimer = setTimeout(() => {
        setIsVisible(true);
      }, 50); // Small delay for smoother animation

      // Start the auto-remove timer
      startTimeRef.current = Date.now();
      remainingTimeRef.current = toast.duration || 3000;

      timeoutRef.current = setTimeout(() => {
        handleRemove();
      }, remainingTimeRef.current);

      return () => {
        clearTimeout(slideInTimer);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, [toast.id, toast.duration, handleRemove]);

    const handleMouseEnter = React.useCallback(() => {
      if (timeoutRef.current && !isRemoving) {
        clearTimeout(timeoutRef.current);
        const elapsed = Date.now() - startTimeRef.current;
        remainingTimeRef.current = Math.max(
          0,
          remainingTimeRef.current - elapsed,
        );
      }
    }, [isRemoving]);

    const handleMouseLeave = React.useCallback(() => {
      if (!isRemoving) {
        startTimeRef.current = Date.now();
        timeoutRef.current = setTimeout(() => {
          handleRemove();
        }, remainingTimeRef.current);
      }
    }, [isRemoving, handleRemove]);

    const dotClasses = {
      primary: "bg-primary",
      success: "bg-[#4A9F7E]",
      error: "bg-[#E05566]",
      warning: "bg-[#D8A24A]",
      info: "bg-[#4D8BC9]",
    };

    const iconClasses = {
      primary: <Icon type="info" className="w-5 h-5 text-primary" />,
      success: <Icon type="check-circle" className="w-5 h-5 text-[#2A7358]" />,
      error: <Icon type="x" className="w-5 h-5 text-[#932231]" />,
      warning: <Icon type="warning" className="w-5 h-5 text-[#7D581C]" />,
      info: <Icon type="info" className="w-5 h-5 text-[#38628E]" />,
    };

    return (
      <div
        className={`flex items-center p-4 bg-white/88 backdrop-blur-xl rounded-2xl shadow-[0_8px_24px_rgba(141,119,247,0.18)] border border-white/85 transition-all duration-300 ease-in-out min-w-80 max-w-md transform ${
          isRemoving
            ? "opacity-0 scale-95 translate-x-full"
            : isVisible
              ? "opacity-100 scale-100 translate-x-0"
              : "opacity-0 scale-95 translate-x-full"
        }`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex-shrink-0 mr-3 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotClasses[toast.type]}`} />
          {iconClasses[toast.type]}
        </div>
        <div className="flex-1">
          <p className="font-medium text-[#1a1a1a]">{toast.message}</p>
        </div>
      </div>
    );
  },
);

ToastItem.displayName = "ToastItem";

export default Toast;

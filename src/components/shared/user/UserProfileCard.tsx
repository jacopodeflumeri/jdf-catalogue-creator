"use client";

import React from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import S3ImageDisplay from "@/modules/s3_images/components/S3ImageDisplay";
import { useSession } from "next-auth/react";
import { useUserProfile } from "@/components/providers/UserProfileProvider";
import { isSessionSuperAdmin } from "@/modules/auth/client";

interface UserProfileCardProps {
  variant?: "desktop" | "mobile";
  onMobileClick?: () => void;
  userType?: "admin" | "customer";
}

/**
 * Self-managed user profile card that handles its own session and token expiration monitoring.
 * This component is isolated to prevent session updates from causing re-renders in parent components.
 */
const UserProfileCard: React.FC<UserProfileCardProps> = ({
  variant = "desktop",
  onMobileClick,
  userType,
}) => {
  const { data: session } = useSession();
  const { userProfile } = useUserProfile();

  const isSuperAdminUser = isSessionSuperAdmin(session);

  const signOutAdmin = async () => {
    window.location.href = "/auth/signout?callbackUrl=%2Fauth%2Fadmin";
  };

  const getSettingsLink = () => {
    if (userType === "admin") {
      return "/admin/user";
    }
    return "/account/settings";
  };

  const getUserInitials = () => {
    if (userProfile) {
      return `${userProfile.firstname.charAt(0)}${userProfile.lastname.charAt(0)}`.toUpperCase();
    }
    if (session?.user?.name) {
      const parts = session.user.name.split(" ");
      if (parts.length >= 2) {
        return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
      }
      return session.user.name.substring(0, 2).toUpperCase();
    }
    if (session?.user?.email) {
      return session.user.email.substring(0, 2).toUpperCase();
    }
    return "??";
  };

  const getUserDisplayName = () => {
    if (userProfile) {
      return `${userProfile.firstname} ${userProfile.lastname}`;
    }
    return session?.user?.name || session?.user?.email || "User";
  };

  return (
    <div className="p-4 border-t border-white/60 flex-shrink-0">
      <Link
        href={getSettingsLink()}
        id={variant === "desktop" ? "sidebar-user" : undefined}
        className="flex items-center space-x-3 p-3 rounded-xl transition-colors bg-white/40 hover:bg-white/60"
        onClick={onMobileClick}
      >
        <div className="flex-shrink-0">
          {userProfile?.image ? (
            <S3ImageDisplay
              s3Image={userProfile.image}
              alt={getUserDisplayName()}
              width={40}
              height={40}
              className="w-10 h-10 rounded-full object-cover"
              fallback={
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary text-sm font-bold">
                  {getUserInitials()}
                </div>
              }
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary text-sm font-bold">
              {getUserInitials()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#1a1a1a] truncate">
            {getUserDisplayName()}
          </p>
          <p className="text-xs text-[#1a1a1a]/50 truncate">
            {session?.user?.email}
          </p>
        </div>
        {isSuperAdminUser && (
          <div className="flex-shrink-0" onClick={(e) => e.preventDefault()}>
            <Button
              variant="override"
              size="xs"
              className="p-0 w-fit bg-transparent border-none shadow-none"
              onClick={signOutAdmin}
            >
              <Icon
                type="lock"
                size="sm"
                className="text-[#1a1a1a]/45 hover:text-primary transition-colors duration-300"
              />
            </Button>
          </div>
        )}
      </Link>
    </div>
  );
};

export default UserProfileCard;

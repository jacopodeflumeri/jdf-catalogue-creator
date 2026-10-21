"use client";

import { useUserProfile } from "@/components/providers/UserProfileProvider";
import {
  hasAccessLevel,
  type AccessLevel,
} from "@/modules/auth/utils/access-control";

/**
 * Client-side hook for checking the current user's access level.
 *
 * Uses the UserProfileProvider (populated server-side in the admin layout)
 * to derive permission booleans without any additional data fetching.
 *
 * @example
 * ```tsx
 * const { canEdit, isAdmin } = useAccessLevel();
 * {canEdit && <Button onClick={handleCreate}>Create</Button>}
 * ```
 */
export function useAccessLevel() {
  const { userProfile } = useUserProfile();

  const accessLevel = (userProfile?.accessLevel || "viewer") as AccessLevel;
  const isSuperAdmin = userProfile?.isSuperAdmin === true;
  const canEdit = isSuperAdmin || hasAccessLevel(accessLevel, "editor");
  const isAdmin = isSuperAdmin || accessLevel === "admin";

  return { accessLevel, isSuperAdmin, canEdit, isAdmin };
}

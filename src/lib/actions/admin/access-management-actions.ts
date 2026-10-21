/**
 * Access Management Server Actions
 *
 * Server actions for managing employee access to the admin panel.
 * Accessible by admins and superadmins.
 */

"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/modules/auth/server";
import { prismaService } from "@/lib/prisma/services";
import logger from "@/lib/utils/logger";
import { sessionAuditActor, writeAuditLog } from "@/modules/audit";
import type { MappTeam } from "@/generated/prisma/client";
import {
  isValidAccessStatus,
  isValidAccessLevel,
} from "@/modules/auth/utils/access-control";

/**
 * Record an access change in the admin audit log. `change` holds only the
 * fields that were actually set, so the row says what changed and nothing else.
 */
async function auditAccessChange(
  session: Awaited<ReturnType<typeof requireAdmin>>,
  member: MappTeam,
  action: string,
  change: { accessStatus?: string; accessLevel?: string; notes?: string },
) {
  const parts = [
    change.accessLevel && `level set to ${change.accessLevel}`,
    change.accessStatus && `status set to ${change.accessStatus}`,
  ].filter(Boolean);
  await writeAuditLog({
    ...sessionAuditActor(session),
    action,
    entityType: "mapp_team",
    entityId: member.id,
    message: `${member.email ?? `Member ${member.id}`}: ${parts.join(", ") || "access notes updated"}`,
    data: change,
  });
}

// ============================================================================
// Get Team Members with Access Control
// ============================================================================

/**
 * Get all Mapp team members with access control filters
 * Accessible by admins and superadmins
 */
export async function getMappTeamAccessList(filters?: {
  accessStatus?: string;
  accessLevel?: string;
  hasLoggedIn?: boolean;
  searchTerm?: string;
}) {
  try {
    await requireAdmin({ requireAdminAccess: true });

    const teamMembers =
      await prismaService.mappTeam.getTeamMembersWithFilters(filters);

    return {
      success: true,
      data: teamMembers,
      count: teamMembers.length,
    };
  } catch (error) {
    logger.error("Error fetching team access list:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch team access list",
      data: [],
      count: 0,
    };
  }
}

// ============================================================================
// Update Employee Access
// ============================================================================

/**
 * Update an employee's access status and level
 * Accessible by admins and superadmins
 */
export async function updateEmployeeAccess(data: {
  employeeId: string;
  accessStatus?: string;
  accessLevel?: string;
  accessNotes?: string;
}) {
  try {
    const session = await requireAdmin({ requireAdminAccess: true });

    // Validate input
    if (data.accessStatus && !isValidAccessStatus(data.accessStatus)) {
      throw new Error("Invalid access status");
    }

    if (data.accessLevel && !isValidAccessLevel(data.accessLevel)) {
      throw new Error("Invalid access level");
    }

    // Prevent admins from suspending or denying their own access
    const isEditingSelf = session.user.adminId === data.employeeId;
    if (
      isEditingSelf &&
      data.accessStatus &&
      ["suspended", "denied"].includes(data.accessStatus)
    ) {
      throw new Error("Cannot suspend or deny your own access");
    }

    // Get admin ID from session for audit trail
    const adminId = session.user.adminId
      ? parseInt(session.user.adminId)
      : undefined;

    // Update access
    const updatedMember = await prismaService.mappTeam.updateTeamMemberAccess(
      data.employeeId,
      {
        accessStatus: data.accessStatus,
        accessLevel: data.accessLevel,
        accessNotes: data.accessNotes,
        authorizedBy: adminId,
        authorizedAt: new Date(),
      },
    );

    logger.log(
      `Access updated for employee ${data.employeeId} by admin ${adminId}`,
    );
    await auditAccessChange(session, updatedMember, "access_updated", {
      accessStatus: data.accessStatus,
      accessLevel: data.accessLevel,
      notes: data.accessNotes,
    });

    // Revalidate relevant paths
    revalidatePath("/admin/mapp-team");

    return {
      success: true,
      data: updatedMember,
      message: "Employee access updated successfully",
    };
  } catch (error) {
    logger.error("Error updating employee access:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update employee access",
    };
  }
}

// ============================================================================
// Bulk Update Employee Access
// ============================================================================

/**
 * Bulk update access status or level for multiple employees
 * Accessible by admins and superadmins
 */
export async function bulkUpdateEmployeeAccess(data: {
  employeeIds: string[];
  accessStatus?: string;
  accessLevel?: string;
  accessNotes?: string;
}) {
  try {
    const session = await requireAdmin({ requireAdminAccess: true });

    // Validate input
    if (!data.employeeIds || data.employeeIds.length === 0) {
      throw new Error("At least one employee must be selected");
    }

    if (data.accessStatus && !isValidAccessStatus(data.accessStatus)) {
      throw new Error("Invalid access status");
    }

    if (data.accessLevel && !isValidAccessLevel(data.accessLevel)) {
      throw new Error("Invalid access level");
    }

    // Prevent admins from changing their own access in bulk
    if (
      session.user.adminId &&
      data.employeeIds.includes(session.user.adminId)
    ) {
      throw new Error(
        "Cannot modify your own access settings in bulk operations",
      );
    }

    // Get admin ID from session for audit trail
    const adminId = session.user.adminId
      ? parseInt(session.user.adminId)
      : undefined;

    // Update each employee
    const results: MappTeam[] = [];
    const errors: string[] = [];

    for (const employeeId of data.employeeIds) {
      try {
        const updated = await prismaService.mappTeam.updateTeamMemberAccess(
          employeeId,
          {
            accessStatus: data.accessStatus,
            accessLevel: data.accessLevel,
            accessNotes: data.accessNotes,
            authorizedBy: adminId,
            authorizedAt: new Date(),
          },
        );
        results.push(updated);
        await auditAccessChange(session, updated, "access_updated", {
          accessStatus: data.accessStatus,
          accessLevel: data.accessLevel,
          notes: data.accessNotes,
        });
      } catch (err) {
        logger.error(`Error updating employee ${employeeId}:`, err);
        errors.push(`Failed to update employee ${employeeId}`);
      }
    }

    logger.log(`Bulk updated ${results.length} employees by admin ${adminId}`);

    // Revalidate relevant paths
    revalidatePath("/admin/mapp-team");

    return {
      success: true,
      data: results,
      count: results.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully updated ${results.length} of ${data.employeeIds.length} employees`,
    };
  } catch (error) {
    logger.error("Error bulk updating employee access:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to bulk update employee access",
    };
  }
}

// ============================================================================
// Revoke Employee Access
// ============================================================================

/**
 * Revoke an employee's access (suspend or deny)
 * Accessible by admins and superadmins
 */
export async function revokeEmployeeAccess(data: {
  employeeId: string;
  revocationType: "suspended" | "denied";
  reason?: string;
}) {
  try {
    const session = await requireAdmin({ requireAdminAccess: true });

    // Prevent admins from revoking their own access
    if (session.user.adminId === data.employeeId) {
      throw new Error("Cannot revoke your own access");
    }

    // Get admin ID from session for audit trail
    const adminId = session.user.adminId
      ? parseInt(session.user.adminId)
      : undefined;

    // Update access status
    const updatedMember = await prismaService.mappTeam.updateTeamMemberAccess(
      data.employeeId,
      {
        accessStatus: data.revocationType,
        accessNotes: data.reason,
        authorizedBy: adminId,
        authorizedAt: new Date(),
      },
    );

    logger.log(
      `Access ${data.revocationType} for employee ${data.employeeId} by admin ${adminId}`,
    );
    await auditAccessChange(session, updatedMember, "access_revoked", {
      accessStatus: data.revocationType,
      notes: data.reason,
    });

    // Revalidate relevant paths
    revalidatePath("/admin/mapp-team");

    return {
      success: true,
      data: updatedMember,
      message: `Employee access ${data.revocationType === "suspended" ? "suspended" : "denied"} successfully`,
    };
  } catch (error) {
    logger.error("Error revoking employee access:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to revoke employee access",
    };
  }
}

// ============================================================================
// Grant Employee Access
// ============================================================================

/**
 * Grant or restore employee access
 * Accessible by admins and superadmins
 */
export async function grantEmployeeAccess(data: {
  employeeId: string;
  accessLevel: string;
  notes?: string;
}) {
  try {
    const session = await requireAdmin({ requireAdminAccess: true });

    // Validate access level
    if (!isValidAccessLevel(data.accessLevel)) {
      throw new Error("Invalid access level");
    }

    // Get admin ID from session for audit trail
    const adminId = session.user.adminId
      ? parseInt(session.user.adminId)
      : undefined;

    // Update access
    const updatedMember = await prismaService.mappTeam.updateTeamMemberAccess(
      data.employeeId,
      {
        accessStatus: "active",
        accessLevel: data.accessLevel,
        accessNotes: data.notes,
        authorizedBy: adminId,
        authorizedAt: new Date(),
      },
    );

    logger.log(
      `Access granted to employee ${data.employeeId} with level ${data.accessLevel} by admin ${adminId}`,
    );
    await auditAccessChange(session, updatedMember, "access_granted", {
      accessStatus: "active",
      accessLevel: data.accessLevel,
      notes: data.notes,
    });

    // Revalidate relevant paths
    revalidatePath("/admin/mapp-team");

    return {
      success: true,
      data: updatedMember,
      message: "Employee access granted successfully",
    };
  } catch (error) {
    logger.error("Error granting employee access:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to grant employee access",
    };
  }
}

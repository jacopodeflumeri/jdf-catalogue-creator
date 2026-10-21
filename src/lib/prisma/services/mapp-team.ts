/**
 * Mapp Team Service - Prisma Implementation
 * Handles Mapp team members and contact information
 */

import { prisma } from "../client";
import type { MappTeam } from "@/generated/prisma/client";
import type { S3Image } from "@/types";
import {
  createTeamMemberSchema,
  updateTeamMemberSchema,
  validateWithZod,
} from "@/lib/validation/prisma-schemas";
import logger from "@/lib/utils/logger";
import { escapeLikePattern } from "@/lib/utils/search";

type CreateMappTeamInput = {
  email?: string;
  firstname?: string;
  lastname?: string;
  title?: string;
  role?: string;
  location?: string;
  image?: S3Image | null;
  accessStatus?: string;
  accessLevel?: string;
  lastLoginAt?: Date;
  authorizedBy?: number;
  authorizedAt?: Date;
  accessNotes?: string;
};

type UpdateMappTeamInput = {
  email?: string;
  firstname?: string;
  lastname?: string;
  title?: string;
  role?: string;
  location?: string;
  image?: S3Image | null;
  accessStatus?: string;
  accessLevel?: string;
  lastLoginAt?: Date;
  authorizedBy?: number;
  authorizedAt?: Date;
  accessNotes?: string;
};

export class PrismaMappTeamService {
  /**
   * Get all team members
   */
  async getAllTeamMembers(): Promise<MappTeam[]> {
    try {
      const team = await prisma.mappTeam.findMany({
        orderBy: {
          firstname: "asc",
        },
      });

      return team;
    } catch (error) {
      logger.error("Error fetching all team members:", error);
      throw error;
    }
  }

  /**
   * Count team members. Used by the new-member bootstrap: if there are zero
   * Mapp team members, the first one to log in becomes active/admin.
   */
  async countTeamMembers(): Promise<number> {
    try {
      return await prisma.mappTeam.count();
    } catch (error) {
      logger.error("Error counting team members:", error);
      throw error;
    }
  }

  /**
   * Get team member by ID
   */
  async getTeamMemberById(id: string): Promise<MappTeam | null> {
    try {
      const member = await prisma.mappTeam.findUnique({
        where: {
          id: parseInt(id),
        },
      });

      return member;
    } catch (error) {
      logger.error("Error fetching team member by ID:", error);
      throw error;
    }
  }

  /**
   * Get team member by email
   */
  async getTeamMemberByEmail(email: string): Promise<MappTeam | null> {
    try {
      const member = await prisma.mappTeam.findFirst({
        where: {
          email: email,
        },
      });

      return member;
    } catch (error) {
      logger.error("Error fetching team member by email:", error);
      throw error;
    }
  }

  /**
   * Get team members by role
   */
  async getTeamMembersByRole(role: string): Promise<MappTeam[]> {
    try {
      const team = await prisma.mappTeam.findMany({
        where: {
          role: role,
        },
        orderBy: {
          firstname: "asc",
        },
      });

      return team;
    } catch (error) {
      logger.error("Error fetching team members by role:", error);
      throw error;
    }
  }

  /**
   * Create team member (or update if exists by email)
   * Uses upsert to handle pre-authorized users on first login
   */
  async createTeamMember(input: CreateMappTeamInput): Promise<MappTeam> {
    try {
      // Validate input data using Zod schema
      const validatedInput = validateWithZod(createTeamMemberSchema, input);

      // If email is provided, use upsert to handle pre-authorized users
      if (validatedInput.email) {
        const member = await prisma.mappTeam.upsert({
          where: {
            email: validatedInput.email,
          },
          update: {
            // Update profile data from Azure/Graph API
            firstname: validatedInput.firstname,
            lastname: validatedInput.lastname,
            title: validatedInput.title,
            role: validatedInput.role,
            location: validatedInput.location,
            image: validatedInput.image ? (validatedInput.image as any) : null,
            // Only update lastLoginAt if it's provided (e.g., during authentication)
            ...(validatedInput.lastLoginAt && {
              lastLoginAt: validatedInput.lastLoginAt,
            }),
            updatedAt: new Date(),
            // NOTE: We intentionally DON'T update access control fields here
            // This preserves pre-authorization settings (accessStatus, accessLevel, etc.)
          },
          create: {
            // Create new record with default access settings
            email: validatedInput.email,
            firstname: validatedInput.firstname,
            lastname: validatedInput.lastname,
            title: validatedInput.title,
            role: validatedInput.role,
            location: validatedInput.location,
            image: validatedInput.image ? (validatedInput.image as any) : null,
            accessStatus: validatedInput.accessStatus || "pending",
            accessLevel: validatedInput.accessLevel || "viewer",
            // Only set lastLoginAt if it's provided (e.g., during authentication)
            // For pre-authorization, this will be undefined/null
            ...(validatedInput.lastLoginAt && {
              lastLoginAt: validatedInput.lastLoginAt,
            }),
          },
        });

        return member;
      }

      // Fallback: create without email (shouldn't happen in auth flow)
      const member = await prisma.mappTeam.create({
        data: {
          email: validatedInput.email,
          firstname: validatedInput.firstname,
          lastname: validatedInput.lastname,
          title: validatedInput.title,
          role: validatedInput.role,
          location: validatedInput.location,
          image: validatedInput.image ? (validatedInput.image as any) : null,
          accessStatus: "pending",
          accessLevel: "viewer",
        },
      });

      return member;
    } catch (error) {
      logger.error("Error creating team member:", error);
      throw error;
    }
  }

  /**
   * Update team member
   */
  async updateTeamMember(
    id: string,
    input: UpdateMappTeamInput,
  ): Promise<MappTeam> {
    try {
      // Validate input data using Zod schema
      const validatedInput = validateWithZod(updateTeamMemberSchema, input);

      // Handle image conversion separately
      const updateData: any = {
        ...validatedInput,
        updatedAt: new Date(),
      };

      // Convert image if present
      if (validatedInput.image !== undefined) {
        updateData.image = validatedInput.image
          ? (validatedInput.image as any)
          : null;
      }

      const member = await prisma.mappTeam.update({
        where: {
          id: parseInt(id),
        },
        data: updateData,
      });

      return member;
    } catch (error) {
      logger.error("Error updating team member:", error);

      // Provide more specific error information
      if (error instanceof Error) {
        if (error.message.includes("Unique constraint")) {
          throw new Error("Email already exists for another team member");
        }
        if (error.message.includes("Record to update not found")) {
          throw new Error("Team member not found");
        }
        if (error.name === "ZodError") {
          throw new Error("Invalid input data provided");
        }
      }

      throw error;
    }
  }

  /**
   * Delete team member
   */
  async deleteTeamMember(id: string): Promise<void> {
    try {
      await prisma.mappTeam.delete({
        where: {
          id: parseInt(id),
        },
      });
    } catch (error) {
      logger.error("Error deleting team member:", error);
      throw error;
    }
  }

  /**
   * Search team members by name or email
   */
  async searchTeamMembers(searchTerm: string): Promise<MappTeam[]> {
    try {
      // Escaped: `%` / `_` match literally, not as wildcards.
      const pattern = escapeLikePattern(searchTerm);
      const team = await prisma.mappTeam.findMany({
        where: {
          OR: [
            { firstname: { contains: pattern, mode: "insensitive" } },
            { lastname: { contains: pattern, mode: "insensitive" } },
            { email: { contains: pattern, mode: "insensitive" } },
          ],
        },
        orderBy: {
          firstname: "asc",
        },
      });

      return team;
    } catch (error) {
      logger.error("Error searching team members:", error);
      throw error;
    }
  }

  /**
   * Get team members with access control filters
   */
  async getTeamMembersWithFilters(filters?: {
    accessStatus?: string;
    accessLevel?: string;
    hasLoggedIn?: boolean;
    searchTerm?: string;
  }): Promise<MappTeam[]> {
    try {
      const where: any = {};

      if (filters?.accessStatus) {
        where.accessStatus = filters.accessStatus;
      }

      if (filters?.accessLevel) {
        where.accessLevel = filters.accessLevel;
      }

      if (filters?.hasLoggedIn !== undefined) {
        if (filters.hasLoggedIn) {
          where.lastLoginAt = { not: null };
        } else {
          where.lastLoginAt = null;
        }
      }

      if (filters?.searchTerm) {
        // Escaped: `%` / `_` match literally, not as wildcards.
        const pattern = escapeLikePattern(filters.searchTerm);
        where.OR = [
          { firstname: { contains: pattern, mode: "insensitive" } },
          { lastname: { contains: pattern, mode: "insensitive" } },
          { email: { contains: pattern, mode: "insensitive" } },
        ];
      }

      const team = await prisma.mappTeam.findMany({
        where,
        orderBy: [{ accessStatus: "asc" }, { firstname: "asc" }],
      });

      return team;
    } catch (error) {
      logger.error("Error getting team members with filters:", error);
      throw error;
    }
  }

  /**
   * Update team member access control
   */
  async updateTeamMemberAccess(
    id: string,
    accessData: {
      accessStatus?: string;
      accessLevel?: string;
      authorizedBy?: number;
      authorizedAt?: Date;
      accessNotes?: string;
    },
  ): Promise<MappTeam> {
    try {
      const member = await prisma.mappTeam.update({
        where: {
          id: parseInt(id),
        },
        data: {
          ...accessData,
          updatedAt: new Date(),
        },
      });

      return member;
    } catch (error) {
      logger.error("Error updating team member access:", error);
      throw error;
    }
  }
}

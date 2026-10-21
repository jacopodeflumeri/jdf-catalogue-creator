/**
 * User Service - Prisma Implementation
 * Clean service layer for user management
 */

import { prisma } from "../client";
import logger from "@/lib/utils/logger";

type User = {
  id: number;
  email: string;
  name: string | null;
  mapp: boolean | null;
  accountId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateUserInput = {
  email: string;
  name?: string;
  mapp?: boolean;
  accountId?: number;
};

type UpdateUserInput = {
  email?: string;
  name?: string;
  mapp?: boolean;
  accountId?: number;
};

export class PrismaUserService {
  /**
   * Get all users
   */
  async getUsers(): Promise<User[]> {
    try {
      const users = await prisma.user.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });

      return users;
    } catch (error) {
      logger.error("Error fetching users:", error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: {
          id: parseInt(userId),
        },
      });

      return user;
    } catch (error) {
      logger.error("Error fetching user by ID:", error);
      throw error;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: {
          email: email,
        },
      });

      return user;
    } catch (error) {
      logger.error("Error fetching user by email:", error);
      throw error;
    }
  }

  /**
   * Create new user
   */
  async createUser(input: CreateUserInput): Promise<User> {
    try {
      const user = await prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          mapp: input.mapp || false,
          accountId: input.accountId,
        },
      });

      return user;
    } catch (error) {
      logger.error("Error creating user:", error);
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(userId: string, input: UpdateUserInput): Promise<User> {
    try {
      const user = await prisma.user.update({
        where: {
          id: parseInt(userId),
        },
        data: {
          ...input,
          updatedAt: new Date(),
        },
      });

      return user;
    } catch (error) {
      logger.error("Error updating user:", error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<boolean> {
    try {
      await prisma.user.delete({
        where: {
          id: parseInt(userId),
        },
      });

      return true;
    } catch (error) {
      logger.error("Error deleting user:", error);
      throw error;
    }
  }
}

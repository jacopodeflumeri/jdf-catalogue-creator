/**
 * Account User Service - Prisma Implementation with Zod Validation
 * Manages relationships between accounts and users
 */

import { prisma } from "../client";
import logger from "@/lib/utils/logger";
import {
  createContactSchema,
  updateContactSchema,
  createAccountUserSchema,
  updateAccountUserSchema,
  validateWithZod,
} from "@/lib/validation/prisma-schemas";

type AccountUser = {
  id: number;
  accountId: number;
  userId: number;
  access: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type AccountUserWithUser = AccountUser & {
  user: {
    id: number;
    email: string;
    name: string | null;
    mapp: boolean | null;
    accountId: number | null;
    createdAt: Date;
    updatedAt: Date;
  };
};

type CreateAccountUserInput = {
  accountId: number;
  userId: number;
  access: string;
  firstName?: string;
  lastName?: string;
  status?: string;
};

type CreateContactInput = {
  account_id: number;
  user_id?: number;
  email: string;
  first_name?: string;
  last_name?: string;
  access?: string;
  status?: string;
  salesforceContactId?: string;
};

type UpdateAccountUserInput = {
  access?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
};

export class PrismaAccountUserService {
  /**
   * Get all users for an account
   */
  async getAccountUsers(accountId: string): Promise<AccountUser[]> {
    try {
      const accountUsers = await prisma.accountUser.findMany({
        where: {
          accountId: parseInt(accountId),
        },
        include: {
          user: true, // Include user details in the response
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return accountUsers;
    } catch (error) {
      logger.error("Error fetching account users:", error);
      throw error;
    }
  }

  /**
   * Create a contact/user for an account
   * This method will:
   * 1. Validate input data using Zod schema
   * 2. Check if a user with the provided email already exists
   * 3. If not, create a new user record
   * 4. Create the account-user relationship linking the user to the account
   *
   * @param data - Contact creation data including email, names, and account info
   * @returns The created AccountUser relationship with user details
   */
  async createContact(data: CreateContactInput): Promise<AccountUserWithUser> {
    try {
      // Validate input data using Zod schema
      const validatedData = validateWithZod(createContactSchema, data);

      let userId = validatedData.user_id;

      // If no user_id provided or it's 0, create a new user
      if (!userId || userId === 0) {
        logger.log(`Creating/finding user for email: ${validatedData.email}`);

        // Check if user already exists by email
        const existingUser = await prisma.user.findUnique({
          where: {
            email: validatedData.email,
          },
        });

        if (existingUser) {
          // Use existing user
          logger.log(`Found existing user with ID: ${existingUser.id}`);
          userId = existingUser.id;
        } else {
          // Create new user
          logger.log(`Creating new user for email: ${validatedData.email}`);
          const newUser = await prisma.user.create({
            data: {
              email: validatedData.email,
              name:
                validatedData.first_name && validatedData.last_name
                  ? `${validatedData.first_name} ${validatedData.last_name}`.trim()
                  : validatedData.first_name || validatedData.last_name || null,
              mapp: false,
              accountId: validatedData.account_id,
            },
          });
          logger.log(`Created new user with ID: ${newUser.id}`);
          userId = newUser.id;
        }
      } else {
        logger.log(`Using provided user ID: ${userId}`);
      }

      // Check if account-user relationship already exists
      logger.log(
        `Checking for existing account-user relationship for account ${validatedData.account_id} and user ${userId}`,
      );
      const existingAccountUser = await prisma.accountUser.findUnique({
        where: {
          accountId_userId: {
            accountId: validatedData.account_id,
            userId: userId,
          },
        },
        include: {
          user: true,
        },
      });

      if (existingAccountUser) {
        logger.log(
          `Found existing account-user relationship with ID: ${existingAccountUser.id}`,
        );
        // Update the existing relationship with new data
        const updatedAccountUser = await prisma.accountUser.update({
          where: { id: existingAccountUser.id },
          data: {
            access: validatedData.access || existingAccountUser.access,
            firstName:
              validatedData.first_name || existingAccountUser.firstName,
            lastName: validatedData.last_name || existingAccountUser.lastName,
            status: validatedData.status || existingAccountUser.status,
          },
          include: {
            user: true,
          },
        });
        logger.log(
          `Updated existing account-user relationship with ID: ${updatedAccountUser.id}`,
        );
        return updatedAccountUser;
      }

      // Create the account-user relationship
      logger.log(
        `Creating account-user relationship for account ${validatedData.account_id} and user ${userId}`,
      );
      const accountUser = await prisma.accountUser.create({
        data: {
          accountId: validatedData.account_id,
          userId: userId,
          access: validatedData.access || "standard",
          firstName: validatedData.first_name,
          lastName: validatedData.last_name,
          status: validatedData.status || "inactive",
        },
        include: {
          user: true, // Include user details in the response
        },
      });

      logger.log(`Successfully created contact with ID: ${accountUser.id}`);
      return accountUser;
    } catch (error) {
      logger.error("Error creating contact:", error);
      throw error;
    }
  }

  /**
   * Update an existing contact
   */
  async updateContact(contactId: number, data: any): Promise<AccountUser> {
    try {
      // Validate input data using Zod schema
      const validatedData = validateWithZod(updateContactSchema, data);

      const accountUser = await prisma.accountUser.update({
        where: { id: contactId },
        data: {
          firstName: validatedData.first_name,
          lastName: validatedData.last_name,
          access: validatedData.access,
          status: validatedData.status,
        },
      });

      return accountUser;
    } catch (error) {
      logger.error("Error updating contact:", error);
      throw error;
    }
  }

  /**
   * Delete a contact
   */
  async deleteContact(contactId: number): Promise<boolean> {
    try {
      await prisma.accountUser.delete({
        where: { id: contactId },
      });

      return true;
    } catch (error) {
      logger.error("Error deleting contact:", error);
      throw error;
    }
  }

  /**
   * Get all accounts for a user
   */
  async getUserAccounts(userId: string): Promise<AccountUser[]> {
    try {
      const accountUsers = await prisma.accountUser.findMany({
        where: {
          userId: parseInt(userId),
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return accountUsers;
    } catch (error) {
      logger.error("Error fetching user accounts:", error);
      throw error;
    }
  }

  /**
   * Get all accounts for a user with account details
   */
  async getUserAccountsWithDetails(userId: string): Promise<any[]> {
    try {
      const accountUsers = await prisma.accountUser.findMany({
        where: {
          userId: parseInt(userId),
        },
        include: {
          account: true, // Include account details
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return accountUsers;
    } catch (error) {
      logger.error("Error fetching user accounts with details:", error);
      throw error;
    }
  }

  /**
   * Create account-user relationship
   */
  async createAccountUser(input: CreateAccountUserInput): Promise<AccountUser> {
    try {
      // Validate input data using Zod schema
      const validatedInput = validateWithZod(createAccountUserSchema, input);

      // Check if account-user relationship already exists
      logger.log(
        `Checking for existing account-user relationship for account ${validatedInput.accountId} and user ${validatedInput.userId}`,
      );
      const existingAccountUser = await prisma.accountUser.findUnique({
        where: {
          accountId_userId: {
            accountId: validatedInput.accountId,
            userId: validatedInput.userId,
          },
        },
      });

      if (existingAccountUser) {
        logger.log(
          `Found existing account-user relationship with ID: ${existingAccountUser.id}`,
        );
        // Update the existing relationship with new data
        const updatedAccountUser = await prisma.accountUser.update({
          where: { id: existingAccountUser.id },
          data: {
            access: validatedInput.access || existingAccountUser.access,
            firstName:
              validatedInput.firstName || existingAccountUser.firstName,
            lastName: validatedInput.lastName || existingAccountUser.lastName,
            status: validatedInput.status || existingAccountUser.status,
          },
        });
        logger.log(
          `Updated existing account-user relationship with ID: ${updatedAccountUser.id}`,
        );
        return updatedAccountUser;
      }

      const accountUser = await prisma.accountUser.create({
        data: {
          accountId: validatedInput.accountId,
          userId: validatedInput.userId,
          access: validatedInput.access,
          firstName: validatedInput.firstName,
          lastName: validatedInput.lastName,
          status: validatedInput.status || "active",
        },
      });

      return accountUser;
    } catch (error) {
      logger.error("Error creating account user:", error);
      throw error;
    }
  }

  /**
   * Update account-user relationship
   */
  async updateAccountUser(
    accountUserId: string,
    input: UpdateAccountUserInput,
  ): Promise<AccountUser> {
    try {
      // Validate input data using Zod schema
      const validatedInput = validateWithZod(updateAccountUserSchema, input);

      const accountUser = await prisma.accountUser.update({
        where: {
          id: parseInt(accountUserId),
        },
        data: {
          ...validatedInput,
          updatedAt: new Date(),
        },
      });

      return accountUser;
    } catch (error) {
      logger.error("Error updating account user:", error);
      throw error;
    }
  }

  /**
   * Delete account-user relationship
   */
  async deleteAccountUser(accountUserId: string): Promise<boolean> {
    try {
      await prisma.accountUser.delete({
        where: {
          id: parseInt(accountUserId),
        },
      });

      return true;
    } catch (error) {
      logger.error("Error deleting account user:", error);
      throw error;
    }
  }

  /**
   * Check if user has access to account
   */
  async checkUserAccess(
    userId: string,
    accountId: string,
  ): Promise<AccountUser | null> {
    try {
      const accountUser = await prisma.accountUser.findFirst({
        where: {
          userId: parseInt(userId),
          accountId: parseInt(accountId),
          status: "active",
        },
      });

      return accountUser;
    } catch (error) {
      logger.error("Error checking user access:", error);
      throw error;
    }
  }
}

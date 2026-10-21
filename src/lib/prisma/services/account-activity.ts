/**
 * Account Activity Service - Prisma Implementation
 * Handles audit logs and activity tracking
 */

import { prisma } from '../client'
import logger from '@/lib/utils/logger'

type AccountActivity = {
  id: number
  createdAt: Date
  userId: number
  accountId: number
  type: string
  details: string | null
  message: string | null
  linkedId: number | null
  mappUserId: number | null
}

type CreateAccountActivityInput = {
  userId: number
  accountId: number
  type: string
  details?: string
  message?: string
  linkedId?: number
  mappUserId?: number
}

export class PrismaAccountActivityService {
  
  /**
   * Get activity logs for an account
   */
  async getAccountActivity(accountId: string): Promise<AccountActivity[]> {
    try {
      const activities = await prisma.accountActivity.findMany({
        where: {
          accountId: parseInt(accountId)
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      
      return activities
    } catch (error) {
      logger.error('Error fetching account activity:', error)
      throw error
    }
  }

  /**
   * Get activity logs for a user
   */
  async getUserActivity(userId: string): Promise<AccountActivity[]> {
    try {
      const activities = await prisma.accountActivity.findMany({
        where: {
          userId: parseInt(userId)
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      
      return activities
    } catch (error) {
      logger.error('Error fetching user activity:', error)
      throw error
    }
  }

  /**
   * Create activity log entry
   */
  async createActivity(input: CreateAccountActivityInput): Promise<AccountActivity> {
    try {
      // Validate that the account exists before creating activity
      const accountExists = await prisma.account.findUnique({
        where: { id: input.accountId },
        select: { id: true }
      });

      if (!accountExists) {
        throw new Error(`Account with ID ${input.accountId} does not exist`);
      }

      // Validate that the user exists before creating activity
      const userExists = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true }
      });

      if (!userExists) {
        throw new Error(`User with ID ${input.userId} does not exist`);
      }

      const activity = await prisma.accountActivity.create({
        data: {
          userId: input.userId,
          accountId: input.accountId,
          type: input.type,
          details: input.details,
          message: input.message,
          linkedId: input.linkedId,
          mappUserId: input.mappUserId
        }
      })
      
      return activity
    } catch (error) {
      logger.error('Error creating activity:', error);
      throw error
    }
  }

  /**
   * Get activity by type
   */
  async getActivityByType(accountId: string, type: string): Promise<AccountActivity[]> {
    try {
      const activities = await prisma.accountActivity.findMany({
        where: {
          accountId: parseInt(accountId),
          type: type
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      
      return activities
    } catch (error) {
      logger.error('Error fetching activity by type:', error)
      throw error
    }
  }

  /**
   * Get activity logs by account ID
   */
  async getActivityLogsByAccountId(accountId: number): Promise<AccountActivity[]> {
    try {
      const activities = await prisma.accountActivity.findMany({
        where: {
          accountId: accountId
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      
      return activities
    } catch (error) {
      logger.error('Error fetching activity logs by account ID:', error)
      throw error
    }
  }

  /**
   * Get all activity logs across all accounts (for admin dashboard)
   */
  async getAllActivityLogs(days: number = 7): Promise<AccountActivity[]> {
    try {
      // Get activities from the last N days
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);
      
      const activities = await prisma.accountActivity.findMany({
        where: {
          createdAt: {
            gte: daysAgo
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      
      return activities
    } catch (error) {
      logger.error('Error fetching all activity logs:', error)
      throw error
    }
  }
}
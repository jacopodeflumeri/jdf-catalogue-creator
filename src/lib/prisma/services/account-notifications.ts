/**
 * Account Notifications Service - Prisma Implementation
 * Handles user notification preferences and settings
 */

import { prisma } from '../client'
import logger from '@/lib/utils/logger'

type AccountNotifications = {
  id: number
  createdAt: Date
  updatedAt: Date
  accountId: number
  userId: number | null
  data: any // flexible JSON storage for notification settings
  status: string | null
}

type CreateAccountNotificationsInput = {
  accountId: number
  userId?: number
  data: any // notification preferences as JSON
  status?: string
}

type UpdateAccountNotificationsInput = {
  userId?: number
  data?: any
  status?: string
}

export class PrismaAccountNotificationsService {
  
  /**
   * Get notification settings for an account
   */
  async getAccountNotifications(accountId: string): Promise<AccountNotifications | null> {
    try {
      const notifications = await prisma.accountNotifications.findFirst({
        where: {
          accountId: parseInt(accountId)
        }
      })
      
      return notifications
    } catch (error) {
      logger.error('Error fetching account notifications:', error)
      throw error
    }
  }

  /**
   * Create notification settings for an account
   */
  async createAccountNotifications(input: CreateAccountNotificationsInput): Promise<AccountNotifications> {
    try {
      const notifications = await prisma.accountNotifications.create({
        data: {
          accountId: input.accountId,
          userId: input.userId,
          data: input.data,
          status: input.status ?? 'active'
        }
      })
      
      return notifications
    } catch (error) {
      logger.error('Error creating account notifications:', error)
      throw error
    }
  }

  /**
   * Update notification settings for an account
   */
  async updateAccountNotifications(
    accountId: string, 
    input: UpdateAccountNotificationsInput
  ): Promise<AccountNotifications | null> {
    try {
      const result = await prisma.accountNotifications.updateMany({
        where: {
          accountId: parseInt(accountId)
        },
        data: {
          ...input,
          updatedAt: new Date()
        }
      })
      
      // Since updateMany doesn't return the updated record, fetch it
      if (result.count > 0) {
        const notifications = await prisma.accountNotifications.findFirst({
          where: {
            accountId: parseInt(accountId)
          }
        })
        return notifications
      }
      
      return null
    } catch (error) {
      logger.error('Error updating account notifications:', error)
      throw error
    }
  }

  /**
   * Update notification data (preferences)
   */
  async updateNotificationData(
    accountId: string, 
    data: any
  ): Promise<AccountNotifications | null> {
    try {
      const result = await prisma.accountNotifications.updateMany({
        where: {
          accountId: parseInt(accountId)
        },
        data: {
          data: data,
          updatedAt: new Date()
        }
      })
      
      // Since updateMany doesn't return the updated record, fetch it
      if (result.count > 0) {
        const notifications = await prisma.accountNotifications.findFirst({
          where: {
            accountId: parseInt(accountId)
          }
        })
        return notifications
      }
      
      return null
    } catch (error) {
      logger.error('Error updating notification data:', error)
      throw error
    }
  }

  /**
   * Delete notification settings
   */
  async deleteAccountNotifications(accountId: string): Promise<void> {
    try {
      await prisma.accountNotifications.deleteMany({
        where: {
          accountId: parseInt(accountId)
        }
      })
    } catch (error) {
      logger.error('Error deleting account notifications:', error)
      throw error
    }
  }
}
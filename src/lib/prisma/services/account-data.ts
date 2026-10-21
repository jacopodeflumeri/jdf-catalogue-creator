/**
 * Account Data Service - Prisma Implementation
 * Handles flexible JSON storage for account-specific data
 */

import { prisma } from '../client'
import {
  createAccountDataSchema,
  updateAccountDataSchema,
  validateWithZod,
} from '@/lib/validation/prisma-schemas';
import logger from '@/lib/utils/logger'

type AccountData = {
  id: number
  accountId: number
  userId: number | null
  type: string
  data: any
  status: string | null
  createdAt: Date
  updatedAt: Date
}

type CreateAccountDataInput = {
  accountId: number
  userId?: number
  type: string
  data: any
  status?: string
}

type UpdateAccountDataInput = {
  userId?: number
  type?: string
  data?: any
  status?: string
}

export class PrismaAccountDataService {
  
  /**
   * Get all account data for an account
   */
  async getAccountData(accountId: string): Promise<AccountData[]> {
    try {
      const accountData = await prisma.accountData.findMany({
        where: {
          accountId: parseInt(accountId)
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      
      return accountData
    } catch (error) {
      logger.error('Error fetching account data:', error)
      throw error
    }
  }

  /**
   * Get account data by type
   */
  async getAccountDataByType(accountId: string, type: string): Promise<AccountData[]> {
    try {
      const accountData = await prisma.accountData.findMany({
        where: {
          accountId: parseInt(accountId),
          type: type
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      
      return accountData
    } catch (error) {
      logger.error('Error fetching account data by type:', error)
      throw error
    }
  }

  /**
   * Get specific account data by ID
   */
  async getAccountDataById(id: string): Promise<AccountData | null> {
    try {
      const accountData = await prisma.accountData.findUnique({
        where: {
          id: parseInt(id)
        }
      })
      
      return accountData
    } catch (error) {
      logger.error('Error fetching account data by ID:', error)
      throw error
    }
  }

  /**
   * Create account data
   */
  async createAccountData(input: CreateAccountDataInput): Promise<AccountData> {
    try {
      // Transform camelCase input to snake_case for validation
      const validationInput = {
        user_id: input.userId,
        account_id: input.accountId,
        type: input.type,
        data: input.data,
        status: input.status
      };
      
      // Validate input data using Zod schema
      const validatedInput = validateWithZod(createAccountDataSchema, validationInput)
      
      const accountData = await prisma.accountData.create({
        data: {
          accountId: validatedInput.account_id,
          userId: validatedInput.user_id,
          type: validatedInput.type,
          data: validatedInput.data,
          status: validatedInput.status || 'active'
        }
      })
      
      return accountData
    } catch (error) {
      logger.error('Error creating account data:', error)
      throw error
    }
  }

  /**
   * Update account data
   */
  async updateAccountData(id: string, input: UpdateAccountDataInput): Promise<AccountData> {
    try {
      // Validate input data using Zod schema
      const validatedInput = validateWithZod(updateAccountDataSchema, input)
      
      const accountData = await prisma.accountData.update({
        where: {
          id: parseInt(id)
        },
        data: {
          // Map validated input to database fields
          accountId: validatedInput.account_id,
          userId: validatedInput.user_id,
          type: validatedInput.type,
          data: validatedInput.data,
          status: validatedInput.status,
          updatedAt: new Date()
        }
      })
      
      return accountData
    } catch (error) {
      logger.error('Error updating account data:', error)
      throw error
    }
  }

  /**
   * Delete account data
   */
  async deleteAccountData(id: string): Promise<boolean> {
    try {
      await prisma.accountData.delete({
        where: {
          id: parseInt(id)
        }
      })
      
      return true
    } catch (error) {
      logger.error('Error deleting account data:', error)
      throw error
    }
  }

  /**
   * Get all account data by type
   */
  async getAllByType(accountId: number, type: string): Promise<AccountData[]> {
    try {
      const accountData = await prisma.accountData.findMany({
        where: {
          accountId: accountId,
          type: type
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      
      return accountData
    } catch (error) {
      logger.error('Error fetching account data by type:', error)
      throw error
    }
  }

  /**
   * Upsert account data (create or update)
   */
  async upsert(data: any): Promise<AccountData> {
    try {
      // Find existing record based on accountId and type only
      // userId is just for tracking who last modified, not for uniqueness
      const existing = await prisma.accountData.findFirst({
        where: {
          accountId: data.account_id,
          type: data.type
        }
      })

      if (existing) {
        // Update existing record, including userId to track who last modified it
        const updated = await prisma.accountData.update({
          where: { id: existing.id },
          data: {
            userId: data.user_id || null,
            data: data.data,
            status: data.status,
            updatedAt: new Date()
          }
        })
        return updated
      } else {
        // Create new record
        const created = await prisma.accountData.create({
          data: {
            accountId: data.account_id,
            userId: data.user_id || null,
            type: data.type,
            data: data.data,
            status: data.status || 'active'
          }
        })
        return created
      }
    } catch (error) {
      logger.error('Error upserting account data:', error)
      throw error
    }
  }

  /**
   * Delete account data by ID
   */
  async delete(recordId: number): Promise<boolean> {
    try {
      await prisma.accountData.delete({
        where: { id: recordId }
      })
      
      return true
    } catch (error) {
      logger.error('Error deleting account data by ID:', error)
      throw error
    }
  }

  /**
   * Get account data by ID
   */
  async getById(id: number): Promise<AccountData | null> {
    try {
      const accountData = await prisma.accountData.findUnique({
        where: { id: id }
      })
      
      return accountData
    } catch (error) {
      logger.error('Error fetching account data by ID:', error)
      throw error
    }
  }

  /**
   * Create account data
   */
  async create(data: any): Promise<AccountData> {
    try {
      const accountData = await prisma.accountData.create({
        data: {
          accountId: data.account_id,
          userId: data.user_id || null,
          type: data.type,
          data: data.data,
          status: data.status || 'active'
        }
      })
      
      return accountData
    } catch (error) {
      logger.error('Error creating account data:', error)
      throw error
    }
  }

  /**
   * Update account data
   */
  async update(id: number, data: any): Promise<AccountData> {
    try {
      const accountData = await prisma.accountData.update({
        where: { id: id },
        data: {
          data: data.data,
          status: data.status,
          updatedAt: new Date()
        }
      })
      
      return accountData
    } catch (error) {
      logger.error('Error updating account data by ID:', error)
      throw error
    }
  }

}
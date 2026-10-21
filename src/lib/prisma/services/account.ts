/**
 * Account Service - Prisma Implementation
 * Clean service layer - only handles current schema fields
 */

import { prisma } from '../client'
import {
  createAccountSchema,
  updateAccountSchema,
  validateWithZod,
} from '@/lib/validation/prisma-schemas';
import logger from '@/lib/utils/logger'

// Core Account type (matches current schema)
type Account = {
  id: number
  name: string | null
  companyName: string | null
  region: string | null
  currency: string | null
  vertical: string | null
  status: string
  stage: string
  sfAccountId: string | null
  domains: any
  createdAt: Date
  updatedAt: Date
}

// Clean input types (only current fields)
type CreateAccountInput = {
  name: string
  companyName: string
  region?: string
  currency?: string
  vertical?: string
  status?: string
  stage?: string
  sfAccountId?: string
  domains?: string[]
}

type UpdateAccountInput = {
  name?: string
  companyName?: string
  region?: string
  currency?: string
  vertical?: string
  status?: string
  stage?: string
  sfAccountId?: string
  domains?: string[]
}

export type AccountWithUsers = Account & {
  accountUsers: any[] // Simplified for now
}

export class PrismaAccountService {
  
  /**
   * Get all accounts (admin view)
   */
  async getAccounts(offset?: number, limit?: number): Promise<AccountWithUsers[]> {
    try {
      const accounts = await prisma.account.findMany({
        include: {
          accountUsers: {
            include: {
              user: true
            }
          }
        },
        skip: offset || 0,
        take: limit || undefined,
        orderBy: {
          createdAt: 'desc'
        }
      })
      
      return accounts
    } catch (error) {
      logger.error('Error fetching accounts:', error)
      throw error
    }
  }

  /**
   * Get specific account by ID
   */
  async getAccountById(accountId: string): Promise<AccountWithUsers | null> {
    try {
      const account = await prisma.account.findUnique({
        where: {
          id: parseInt(accountId)
        },
        include: {
          accountUsers: {
            include: {
              user: true
            }
          }
        }
      })
      
      return account
    } catch (error) {
      logger.error('Error fetching account by ID:', error)
      throw error
    }
  }

  /**
   * Create new account
   */
  async createAccount(input: CreateAccountInput): Promise<Account> {
    try {
      // Validate input data using Zod schema
      const validatedInput = validateWithZod(createAccountSchema, input)
      
      const account = await prisma.account.create({
        data: {
          name: validatedInput.name,
          companyName: validatedInput.companyName,
          region: validatedInput.region,
          currency: validatedInput.currency,
          vertical: validatedInput.vertical,
          status: validatedInput.status || 'Prospect', // Default to 'Prospect' instead of 'active'
          stage: validatedInput.stage || 'Discovery', // Use provided stage or default to 'Discovery'
          sfAccountId: validatedInput.sfAccountId,
          domains: [] // Default empty domains array
        }
      })
      
      return account
    } catch (error) {
      logger.error('Error creating account:', error)
      throw error
    }
  }

  /**
   * Update account details
   */
  async updateAccount(accountId: string, input: UpdateAccountInput): Promise<Account> {
    try {
      // Validate input data using Zod schema
      const validatedInput = validateWithZod(updateAccountSchema, input, 'updateAccount')
      
      const account = await prisma.account.update({
        where: {
          id: parseInt(accountId)
        },
        data: {
          ...validatedInput,
          updatedAt: new Date()
        }
      })
      
      return account
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      // Use logger instead of logger.error for better production handling
      if (typeof console !== 'undefined' && logger.error) {
        logger.error('Error updating account:', {
          accountId,
          input,
          error: errorMessage,
          stack: errorStack
        });
      }
      
      throw error
    }
  }

  /**
   * Update account status and stage
   */
  async updateAccountStage(accountId: string, data: {
    status?: string
    stage?: string
    vertical?: string
    domains?: string[]
    name?: string
    region?: string
    currency?: string
    companyName?: string
    sfAccountId?: string
  }): Promise<Account> {
    try {
      const account = await prisma.account.update({
        where: {
          id: parseInt(accountId)
        },
        data: {
          ...data,
          updatedAt: new Date()
        }
      })
      
      return account
    } catch (error) {
      logger.error('Error updating account stage:', error)
      throw error
    }
  }

  /**
   * Check if Salesforce account exists - returns all matching accounts
   */
  async checkSfAccountExists(sfAccountId: string): Promise<Account[]> {
    try {
      const accounts = await prisma.account.findMany({
        where: {
          sfAccountId: sfAccountId
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      
      return accounts
    } catch (error) {
      logger.error('Error checking SF account:', error)
      throw error
    }
  }
}
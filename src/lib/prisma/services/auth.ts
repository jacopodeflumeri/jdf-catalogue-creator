/**
 * Auth Service - Prisma Implementation
 * Handles authentication-related operations
 */

import { prisma } from '../client'
import crypto from 'crypto'
import { config } from '@/config'
import logger from '@/lib/utils/logger'

type MagicLinkData = {
  id: number
  email: string
  token: string
  expiresAt: Date
  used: boolean
  createdAt: Date
  updatedAt: Date
}

export class PrismaAuthService {

  /**
   * Get magic link data
   */
  async getMagicLink(data: { email?: string; token?: string }): Promise<MagicLinkData | null> {
    try {
      // Find magic link by email or token
      const whereClause: any = {}

      if (data.email) {
        whereClause.email = data.email
      }

      if (data.token) {
        whereClause.token = data.token
      }

      const magicLink = await prisma.magicLink.findFirst({
        where: whereClause
      })

      return magicLink || null
    } catch (error) {
      logger.error('Error fetching magic link:', error)
      throw error
    }
  }

  /**
   * Create magic link
   */
  async createMagicLink(email: string, token: string, expiresAt: Date): Promise<MagicLinkData> {
    try {
      const magicLink = await prisma.magicLink.create({
        data: {
          email,
          token,
          expiresAt,
          used: false
        }
      })

      return magicLink
    } catch (error) {
      logger.error('Error creating magic link:', error)
      throw error
    }
  }

  /**
   * Mark magic link as used
   */
  async useMagicLink(token: string): Promise<boolean> {
    try {
      await prisma.magicLink.update({
        where: { token },
        data: {
          used: true,
          updatedAt: new Date()
        }
      })

      return true
    } catch (error) {
      logger.error('Error using magic link:', error)
      throw error
    }
  }

  /**
   * Generate a new magic link token and create database record
   */
  async generateMagicLinkToken(email: string, expirationMinutes?: number): Promise<string> {
    try {
      // Delete any existing unused magic links for this email first
      await prisma.magicLink.deleteMany({
        where: {
          email: email,
          used: false
        }
      })

      // Generate secure random token
      const token = crypto.randomBytes(32).toString('hex')

      // Calculate expiration time
      const expiresAt = new Date()
      const expiry = expirationMinutes || config.magicLink.expirySeconds / 60 // seconds -> minutes
      expiresAt.setMinutes(expiresAt.getMinutes() + expiry)

      // Create magic link record
      await this.createMagicLink(email, token, expiresAt)

      return token
    } catch (error) {
      logger.error('Error generating magic link token:', error)
      throw error
    }
  }

  /**
   * Generate magic link URL for a user by email
   */
  async generateMagicLinkUrl(email: string, redirectPath?: string): Promise<string> {
    try {
      const token = await this.generateMagicLinkToken(email)

      const baseUrl = config.app.url ||
        (typeof window !== 'undefined' ? window.location.origin : '')

      const redirectParam = redirectPath ? `&redirect=${encodeURIComponent(redirectPath)}` : ''

      return `${baseUrl}/auth/verify?token=${token}${redirectParam}`
    } catch (error) {
      logger.error('Error generating magic link URL:', error)
      throw error
    }
  }

  /**
   * Clean up expired magic links
   */
  async cleanupExpiredMagicLinks(): Promise<number> {
    try {
      const result = await prisma.magicLink.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { used: true }
          ]
        }
      })

      return result.count
    } catch (error) {
      logger.error('Error cleaning up expired magic links:', error)
      throw error
    }
  }

}
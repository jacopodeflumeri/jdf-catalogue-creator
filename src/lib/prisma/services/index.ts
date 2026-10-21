/**
 * Prisma Services Index
 * Central export for all Prisma services
 */

import { PrismaAccountService } from './account'
import { PrismaUserService } from './user'
import { PrismaAccountUserService } from './account-user'
import { PrismaAccountDataService } from './account-data'
import { PrismaAccountActivityService } from './account-activity'
import { PrismaAccountNotificationsService } from './account-notifications'
import { PrismaMappTeamService } from './mapp-team'
import { PrismaAuthService } from './auth'
import { PrismaCompanyUserService } from './company-user'
import { PrismaAuthSessionService } from './auth-session'
import { PrismaAuditLogService } from './audit-log'

export { PrismaAccountService } from './account'
export { PrismaUserService } from './user'
export { PrismaAccountUserService } from './account-user'
export { PrismaAccountDataService } from './account-data'
export { PrismaAccountActivityService } from './account-activity'
export { PrismaAccountNotificationsService } from './account-notifications'
export { PrismaMappTeamService } from './mapp-team'
export { PrismaAuthService } from './auth'
export { PrismaCompanyUserService } from './company-user'
export { PrismaAuthSessionService } from './auth-session'
export { PrismaAuditLogService } from './audit-log'

// Export types
export type { AccountWithUsers } from './account'

// Main service factory
export class PrismaService {
  public account = new PrismaAccountService()
  public user = new PrismaUserService()
  public accountUser = new PrismaAccountUserService()
  public accountData = new PrismaAccountDataService()
  public accountActivity = new PrismaAccountActivityService()
  public accountNotifications = new PrismaAccountNotificationsService()
  public mappTeam = new PrismaMappTeamService()
  public auth = new PrismaAuthService()
  public companyUser = new PrismaCompanyUserService()
  public authSession = new PrismaAuthSessionService()
  public auditLog = new PrismaAuditLogService()
}

// Singleton instance
export const prismaService = new PrismaService()
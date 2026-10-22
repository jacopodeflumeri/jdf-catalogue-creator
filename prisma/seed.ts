/**
 * Database Seed Script
 *
 * Seeds the database with sample data for local development.
 * Run with: make dev-db-seed  (or: npx prisma db seed)
 *
 * This script is idempotent — it uses upserts so it can be run repeatedly
 * without creating duplicates.
 *
 * When building on this template, add your own seed data in the sections below.
 */

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { CATALOG_PROFILES } from '../src/modules/synthetic_catalog/config/profiles'
import { mergeSeedCatalogConfig } from '../src/modules/synthetic_catalog/config/seed-config'

// Match the app's runtime behavior: construct DATABASE_URL from DB_* if it
// isn't set explicitly. Keeps the seed script working when users follow the
// .env.example convention of leaving DATABASE_URL commented out.
function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const host = process.env.DB_HOST ?? 'localhost'
  const port = process.env.DB_PORT ?? '5432'
  const user = process.env.DB_USER ?? 'postgres'
  const password = encodeURIComponent(process.env.DB_PASSWORD ?? '')
  const dbname = process.env.DB_NAME
  if (!dbname) {
    throw new Error('Cannot construct DATABASE_URL: DB_NAME is not set in .env')
  }
  return `postgresql://${user}:${password}@${host}:${port}/${dbname}`
}

const useSSL = process.env.DB_SSL === 'true'
const adapter = new PrismaPg({
  connectionString: resolveDatabaseUrl(),
  ...(useSSL && { ssl: { rejectUnauthorized: false } }),
})
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...\n')

  // =========================================================================
  // Accounts
  // =========================================================================
  console.log('Creating accounts...')

  const acmeCorp = await prisma.account.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Acme Corp',
      companyName: 'Acme Corp',
      region: 'EMEA',
      currency: 'EUR',
      vertical: 'Technology',
      status: 'Active',
      stage: 'Onboarding',
    },
  })

  const globexInc = await prisma.account.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: 'Globex Inc',
      companyName: 'Globex Inc',
      region: 'NA',
      currency: 'USD',
      vertical: 'Retail',
      status: 'Active',
      stage: 'Live',
    },
  })

  const initechLtd = await prisma.account.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: 'Initech Ltd',
      companyName: 'Initech Ltd',
      region: 'APAC',
      currency: 'GBP',
      vertical: 'Finance',
      status: 'Prospect',
      stage: 'Discovery',
    },
  })

  console.log(`  Created accounts: ${acmeCorp.name}, ${globexInc.name}, ${initechLtd.name}`)

  // =========================================================================
  // Users
  // =========================================================================
  console.log('Creating users...')

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      name: 'Alice Johnson',
      mapp: false,
      accountId: acmeCorp.id,
    },
  })

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      name: 'Bob Smith',
      mapp: false,
      accountId: globexInc.id,
    },
  })

  const carol = await prisma.user.upsert({
    where: { email: 'carol@example.com' },
    update: {},
    create: {
      email: 'carol@example.com',
      name: 'Carol Williams',
      mapp: false,
      accountId: acmeCorp.id,
    },
  })

  const mappAdmin = await prisma.user.upsert({
    where: { email: 'admin@mapp.com' },
    update: {},
    create: {
      email: 'admin@mapp.com',
      name: 'Mapp Admin',
      mapp: true,
    },
  })

  console.log(`  Created users: ${alice.name}, ${bob.name}, ${carol.name}, ${mappAdmin.name}`)

  // =========================================================================
  // Account-User Relationships
  // =========================================================================
  console.log('Creating account-user relationships...')

  await prisma.accountUser.upsert({
    where: { accountId_userId: { accountId: acmeCorp.id, userId: alice.id } },
    update: {},
    create: {
      accountId: acmeCorp.id,
      userId: alice.id,
      access: 'admin',
      firstName: 'Alice',
      lastName: 'Johnson',
      status: 'active',
    },
  })

  await prisma.accountUser.upsert({
    where: { accountId_userId: { accountId: acmeCorp.id, userId: carol.id } },
    update: {},
    create: {
      accountId: acmeCorp.id,
      userId: carol.id,
      access: 'customer',
      firstName: 'Carol',
      lastName: 'Williams',
      status: 'active',
    },
  })

  await prisma.accountUser.upsert({
    where: { accountId_userId: { accountId: globexInc.id, userId: bob.id } },
    update: {},
    create: {
      accountId: globexInc.id,
      userId: bob.id,
      access: 'admin',
      firstName: 'Bob',
      lastName: 'Smith',
      status: 'active',
    },
  })

  // Bob also has access to Acme Corp (multi-account user)
  await prisma.accountUser.upsert({
    where: { accountId_userId: { accountId: acmeCorp.id, userId: bob.id } },
    update: {},
    create: {
      accountId: acmeCorp.id,
      userId: bob.id,
      access: 'customer',
      firstName: 'Bob',
      lastName: 'Smith',
      status: 'active',
    },
  })

  console.log('  Created account-user relationships')

  // =========================================================================
  // Mapp Team Members (Admins)
  // =========================================================================
  console.log('Creating Mapp team members...')

  const teamAdmin = await prisma.mappTeam.upsert({
    where: { email: 'admin@mapp.com' },
    update: {},
    create: {
      email: 'admin@mapp.com',
      firstname: 'Mapp',
      lastname: 'Admin',
      title: 'Platform Administrator',
      role: 'Engineering',
      location: 'Berlin',
      accessStatus: 'active',
      accessLevel: 'admin',
    },
  })

  await prisma.mappTeam.upsert({
    where: { email: 'viewer@mapp.com' },
    update: {},
    create: {
      email: 'viewer@mapp.com',
      firstname: 'Mapp',
      lastname: 'Viewer',
      title: 'Customer Success Manager',
      role: 'Customer Success',
      location: 'London',
      accessStatus: 'active',
      accessLevel: 'viewer',
      authorizedBy: teamAdmin.id,
      authorizedAt: new Date(),
    },
  })

  console.log('  Created Mapp team members')

  // =========================================================================
  // Account Data (sample module configurations)
  // =========================================================================
  console.log('Creating account data...')

  await prisma.accountData.create({
    data: {
      accountId: acmeCorp.id,
      userId: alice.id,
      type: 'modules',
      data: {
        email: { enabled: true, provider: 'mapp_engage' },
        analytics: { enabled: true, trackingId: 'ACME-001' },
        push: { enabled: false },
      },
      status: 'active',
    },
  })

  await prisma.accountData.create({
    data: {
      accountId: globexInc.id,
      userId: bob.id,
      type: 'modules',
      data: {
        email: { enabled: true, provider: 'mapp_engage' },
        analytics: { enabled: false },
        push: { enabled: true, platform: 'firebase' },
      },
      status: 'active',
    },
  })

  console.log('  Created account data entries')

  // =========================================================================
  // Account Activity (sample audit log entries)
  // =========================================================================
  console.log('Creating activity logs...')

  await prisma.accountActivity.create({
    data: {
      userId: alice.id,
      accountId: acmeCorp.id,
      type: 'account_created',
      message: 'Account was created',
      details: 'Initial account setup completed',
    },
  })

  await prisma.accountActivity.create({
    data: {
      userId: alice.id,
      accountId: acmeCorp.id,
      type: 'user_login',
      message: 'User logged in',
    },
  })

  await prisma.accountActivity.create({
    data: {
      userId: bob.id,
      accountId: globexInc.id,
      type: 'account_created',
      message: 'Account was created',
      details: 'Initial account setup completed',
    },
  })

  console.log('  Created activity log entries')

  // =========================================================================
  // Account Notifications
  // =========================================================================
  console.log('Creating notification preferences...')

  await prisma.accountNotifications.create({
    data: {
      accountId: acmeCorp.id,
      userId: alice.id,
      data: {
        emailDigest: true,
        loginAlerts: true,
        weeklyReport: false,
      },
      status: 'active',
    },
  })

  console.log('  Created notification preferences')

  // =========================================================================
  // Synthetic catalog profiles
  // =========================================================================
  console.log('Creating synthetic catalog profiles...')

  for (const profile of CATALOG_PROFILES) {
    const current = await prisma.syntheticCatalog.findUnique({
      where: { slug: profile.slug },
      select: { config: true },
    })
    const config = current
      ? mergeSeedCatalogConfig(profile.config, current.config)
      : profile.config
    await prisma.syntheticCatalog.upsert({
      where: { slug: profile.slug },
      update: {
        name: profile.name,
        segment: profile.segment,
        brandName: profile.brandName,
        externalPrefix: profile.externalPrefix,
        config: JSON.parse(JSON.stringify(config)),
        defaultTextModel: profile.defaultTextModel,
        defaultImageModel: profile.defaultImageModel,
        active: true,
      },
      create: {
        slug: profile.slug,
        name: profile.name,
        segment: profile.segment,
        brandName: profile.brandName,
        externalPrefix: profile.externalPrefix,
        config: JSON.parse(JSON.stringify(config)),
        defaultTextModel: profile.defaultTextModel,
        defaultImageModel: profile.defaultImageModel,
      },
    })
  }

  console.log(`  Created ${CATALOG_PROFILES.length} synthetic catalog profiles`)

  console.log('\nSeeding complete!')
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

'use server';

import { cache } from 'react';
import type { Session } from 'next-auth';
import logger from '@/lib/utils/logger';
import { requireCustomer } from '@/modules/auth/server';
import { assertNotPreview } from '@/modules/customer_preview';
import { prismaService } from '@/lib/prisma/services';
import { revalidatePath } from 'next/cache';

import type { CustomerAccountData } from '@/types';

/**
 * Server Actions for Customer Profile Management
 * All actions include authentication and authorization checks
 */

export async function getCustomerProfile(): Promise<CustomerAccountData | null> {
  const session = await requireCustomer();
  return loadCustomerProfile(session);
}

/**
 * Memoized per request (React `cache`, keyed on the session object, which
 * `requireCustomer` resolves once per request): the customer layout, the page
 * and `requireFeature` each ask for the profile, and now share one load.
 * Not exported — a 'use server' file may only export async functions.
 */
const loadCustomerProfile = cache(async (session: Session): Promise<CustomerAccountData | null> => {
  try {

    const accountData = await prismaService.account.getAccountById(session.user.accountId || '');

    if (!accountData) {
      return null;
    }

    // Check if this is an admin viewing an account - skip multi-account check
    const isAdminViewing = session.user.role === 'admin';
    let multipleAccounts = false;
    
    if (!isAdminViewing && session.user.userId) {
      const accountUsers = await prismaService.accountUser.getUserAccounts(session.user.userId);
      multipleAccounts = accountUsers && accountUsers.length > 1;
    }

    // Import the stages configuration to determine status from stage
    const { DEFAULT_STAGES } = await import('@/config/admin-defaults');
    
    // Determine the correct status based on the account's stage
    let correctStatus = accountData.status;
    if (accountData.stage) {
      for (const [status, stages] of Object.entries(DEFAULT_STAGES)) {
        if (stages.includes(accountData.stage)) {
          correctStatus = status;
          break;
        }
      }
    }

    const accountFlags = {
      isCustomer: correctStatus === 'Customer',
      isActiveCustomer: correctStatus === 'Customer' && accountData.stage !== 'Onboarding',
      isOnboardingCustomer: correctStatus === 'Customer' && accountData.stage === 'Onboarding',
      isProspect: correctStatus === 'Prospect',
      isLiveAccount: correctStatus === 'Customer' || correctStatus === 'Prospect',
    };

    const enabledFeatures = {
      accountEnabled: accountFlags.isActiveCustomer || false,
      modulesEnabled: accountFlags.isActiveCustomer || false,
      supportEnabled: accountFlags.isActiveCustomer || false,
      teamEnabled: accountFlags.isLiveAccount || false,
      // Add other features as needed
    };

    // Transform and filter account data for customer view
    // Remove admin-only fields and internal data
    const customerProfile: CustomerAccountData = {
      id: accountData.id?.toString() || '',
      email: session.user.email || '', // Use email from session since account doesn't store it
      name: accountData.name || accountData.companyName || 'Unknown Company',
      company: accountData.name || accountData.companyName || 'Unknown Company',
      region: accountData.region || '',
      currency: accountData.currency || '',
      vertical: accountData.vertical || '',
      domains: accountData.domains || [],
      status: accountData.status as "Customer" | "Prospect" | "Hidden" || 'Customer',
      stage: accountData.stage || 'Active',
      createdAt: accountData.createdAt ? accountData.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: accountData.updatedAt ? accountData.updatedAt.toISOString() : new Date().toISOString(),
      enabledFeatures: enabledFeatures,
      accountFlags: accountFlags,
      hasMultipleAccounts: multipleAccounts
    };

    return customerProfile;
  } catch (error) {
    logger.error('Failed to load customer profile:', error);
    throw new Error('Failed to load customer profile');
  }
});

export async function updateCustomerProfileRequest(data: {
  requestType: 'contact_update' | 'company_update' | 'billing_update';
  requestDetails: string;
  currentData?: any;
  requestedChanges?: any;
}) {
  const session = await requireCustomer();
  // Customer mutation: refused during an admin "View as customer" preview.
  assertNotPreview(session);

  try {
    // In a real implementation, this would create a support ticket or 
    // send a request to admin team since customers typically can't 
    // directly modify their core account data
    
    // For now, we'll just log the request and could integrate with
    // a ticketing system or email notification
    logger.log('Customer profile update request:', {
      customerId: session.user.accountId,
      customerEmail: session.user.email,
      ...data
    });

    // This could create a support ticket, send an email to admins, etc.
    // For now, we'll just return success
    
    revalidatePath('/account/profile');
    return { success: true, message: 'Update request submitted successfully' };
  } catch (error) {
    logger.error('Failed to submit profile update request:', error);
    throw new Error('Failed to submit profile update request');
  }
}

/**
 * Check if the current customer's account is disabled
 */
export async function isCustomerAccountDisabled(): Promise<boolean> {
  try {
    const session = await requireCustomer();

    const disabledData = await prismaService.accountData.getAllByType(parseInt(session.user.accountId || ''), 'disabled');
    
    return disabledData.length > 0 && disabledData[0]?.status === 'disabled';
  } catch (error) {
    logger.error('Error checking customer account disabled status:', error);
    return false;
  }
}


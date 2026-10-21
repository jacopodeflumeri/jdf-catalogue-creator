/**
 * Account-related types
 * Includes account data, contacts, team members, and account features
 */

import { DEFAULT_STAGES } from '@/config/admin-defaults';
import type { S3Image } from '@/modules/s3_images/types';

// Account Status and Stage types
export type AccountStatus = keyof typeof DEFAULT_STAGES;
export type AccountStage = typeof DEFAULT_STAGES.Prospect[number] | typeof DEFAULT_STAGES.Customer[number];

// Account and Admin data types
export interface AccountData extends Record<string, unknown> {
  id: string;
  email: string;
  name: string;
  company: string;
  region?: string;
  currency?: string;
  vertical?: string;
  domains?: string[];
  status: AccountStatus;
  stage: AccountStage;
  sf_account_id?: string;
  createdAt: string;
  updatedAt: string;
  lastActive: string;
  contacts?: AccountContactData[];
  teamMembers?: AccountTeamMemberData[];
}

// Customer-specific account data (filtered view for customers)
export interface CustomerAccountData {
  id: string;
  email: string;
  name: string;
  company: string;
  region?: string;
  currency?: string;
  vertical?: string;
  domains?: string[];
  status: AccountStatus;
  stage: AccountStage;
  createdAt: string;
  updatedAt: string;
  enabledFeatures?: AccountEnabledFeatures;
  accountFlags?: AccountFlags;
  hasMultipleAccounts?: boolean;
  // Note: Some fields like internal notes, admin-only data are excluded
}

export interface AccountEnabledFeatures {
  accountEnabled: boolean;
  modulesEnabled: boolean;
  supportEnabled: boolean;
  teamEnabled: boolean;
}

export interface AccountFlags {
  isCustomer: boolean;
  isProspect: boolean;
  isLiveAccount: boolean;
  isActiveCustomer: boolean;
  isOnboardingCustomer: boolean;
}

// Account User and Contact Types
export interface AccountContactData {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role?: string;
  department?: string;
  phone?: string;
  isActive: boolean;
  lastLogin?: string;
  access: string;
  status: string;
}

export interface AccountTeamMemberData {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  title?: string;
  firstname?: string;
  lastname?: string;
  image?: S3Image;
  isActive: boolean;
  access: string;
  status: string;
  // Access control fields
  lastLoginAt?: string;
}


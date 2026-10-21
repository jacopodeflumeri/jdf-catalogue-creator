/**
 * Server-Side Access Control - Feature Flags
 * 
 * This module provides server-side helpers for checking feature access
 * based on customer account settings. All checks happen on the server
 * before the page renders, preventing content flash and improving security.
 * 
 * Features:
 * - Single feature checks (requireFeature)
 * - Multiple feature checks with OR logic (requireAnyFeature)
 * - Multiple feature checks with AND logic (requireAllFeatures)
 * - Non-redirecting checks (checkFeature)
 * - Server-side only execution
 * 
 * @example Single feature requirement
 * ```typescript
 * import { requireFeature } from '@/modules/auth';
 *
 * export default async function ModulesPage() {
 *   await requireFeature('modulesEnabled');
 *   return <div>Modules content</div>;
 * }
 * ```
 * 
 * @example Multiple feature requirements (OR)
 * ```typescript
 * // User needs at least ONE of these features
 * await requireAnyFeature(['modulesEnabled', 'teamEnabled']);
 * ```
 * 
 * @example Multiple feature requirements (AND)
 * ```typescript
 * // User needs ALL of these features
 * await requireAllFeatures(['modulesEnabled', 'teamEnabled']);
 * ```
 * 
 * @example Conditional rendering without redirect
 * ```typescript
 * const { isEnabled, profile } = await checkFeature('modulesEnabled');
 * if (isEnabled) {
 *   return <ModulesView />;
 * }
 * return <UpgradePrompt />;
 * ```
 */

'use server';

import { redirect } from 'next/navigation';
import { getCustomerProfile } from '@/lib/actions/account/account-profile-actions';
import type { AccountEnabledFeatures } from '@/types';
import logger from '@/lib/utils/logger';
import type { RequireFeatureOptions } from '../types';

/**
 * Server-side feature access check with automatic redirect
 * 
 * Validates that the current customer has access to a specific feature.
 * Automatically redirects if the feature is not enabled. Perfect for Server Components
 * that require specific feature access.
 * 
 * The customer session is validated via getCustomerProfile(), which internally
 * calls requireCustomer(). No need to separately validate authentication.
 * 
 * @param featureKey - The feature to check (e.g., 'modulesEnabled', 'modulesEnabled')
 * @param options - Optional configuration for redirect behavior
 * @returns The customer profile if feature is enabled (never returns null - redirects instead)
 * @throws Redirects if feature is not enabled
 * 
 * @example Basic feature protection
 * ```typescript
 * export default async function ModulesPage() {
 *   await requireFeature('modulesEnabled');
 *   return <div>Browse Modules</div>;
 * }
 * ```
 * 
 * @example Custom redirect path
 * ```typescript
 * await requireFeature('modulesEnabled', { redirectTo: '/account/settings' });
 * ```
 */
export async function requireFeature(
  featureKey: keyof AccountEnabledFeatures,
  options: RequireFeatureOptions = {}
): Promise<Awaited<ReturnType<typeof getCustomerProfile>>> {
  const { redirectTo = '/account' } = options;
  
  const profile = await getCustomerProfile();
  
  if (!profile?.enabledFeatures?.[featureKey]) {
    logger.warn(`Feature '${featureKey}' not enabled for customer account ${profile?.id}`);
    redirect(redirectTo);
  }
  
  return profile;
}

/**
 * Server-side multiple feature access check (OR logic)
 * 
 * Validates that the current customer has access to at least ONE of the specified features.
 * Useful for routes that can be accessed with multiple different permissions.
 * Automatically redirects if NONE of the features are enabled.
 * 
 * @param featureKeys - Array of features to check (OR logic - any one can grant access)
 * @param options - Optional configuration for redirect behavior
 * @returns The customer profile if at least one feature is enabled
 * @throws Redirects if none of the features are enabled
 * 
 * @example Multiple access paths
 * ```typescript
 * // User can access if they have either team features
 * await requireAnyFeature(['teamEnabled', 'modulesEnabled']);
 * ```
 */
export async function requireAnyFeature(
  featureKeys: (keyof AccountEnabledFeatures)[],
  options: RequireFeatureOptions = {}
): Promise<Awaited<ReturnType<typeof getCustomerProfile>>> {
  const { redirectTo = '/account' } = options;
  
  const profile = await getCustomerProfile();
  
  const hasAnyFeature = featureKeys.some(key => 
    Boolean(profile?.enabledFeatures?.[key])
  );
  
  if (!hasAnyFeature) {
    logger.warn(`None of the required features [${featureKeys.join(', ')}] enabled for customer account ${profile?.id}`);
    redirect(redirectTo);
  }
  
  return profile;
}

/**
 * Server-side multiple feature access check (AND logic)
 * 
 * Validates that the current customer has access to ALL of the specified features.
 * Useful for advanced pages that require multiple feature combinations.
 * Automatically redirects if ANY of the features are disabled.
 * 
 * @param featureKeys - Array of features to check (AND logic - all must be enabled)
 * @param options - Optional configuration for redirect behavior
 * @returns The customer profile if all features are enabled
 * @throws Redirects if any of the features are disabled
 * 
 * @example Combined requirements
 * ```typescript
 * // Require both features to be enabled
 * await requireAllFeatures(['modulesEnabled', 'teamEnabled']);
 * ```
 * 
 * @example Advanced feature gate
 * ```typescript
 * // Page requires all three features
 * await requireAllFeatures([
 *   'modulesEnabled',
 *   'analyticsEnabled'
 * ]);
 * ```
 */
export async function requireAllFeatures(
  featureKeys: (keyof AccountEnabledFeatures)[],
  options: RequireFeatureOptions = {}
): Promise<Awaited<ReturnType<typeof getCustomerProfile>>> {
  const { redirectTo = '/account' } = options;
  
  const profile = await getCustomerProfile();
  
  const hasAllFeatures = featureKeys.every(key => 
    Boolean(profile?.enabledFeatures?.[key])
  );
  
  if (!hasAllFeatures) {
    const missingFeatures = featureKeys.filter(key => !profile?.enabledFeatures?.[key]);
    logger.warn(`Missing required features [${missingFeatures.join(', ')}] for customer account ${profile?.id}`);
    redirect(redirectTo);
  }
  
  return profile;
}

/**
 * Server-side feature check without redirect
 * 
 * Checks if a feature is enabled without redirecting. Useful for conditional
 * rendering, logic branching, or when you want to handle the disabled state
 * manually instead of redirecting.
 * 
 * @param featureKey - The feature to check
 * @returns Object with isEnabled boolean and the customer profile
 * 
 * @example Conditional rendering
 * ```typescript
 * export default async function DashboardPage() {
 *   const { isEnabled, profile } = await checkFeature('modulesEnabled');
 *   
 *   return (
 *     <div>
 *       {isEnabled ? (
 *         <ModulesWidget account={profile} />
 *       ) : (
 *         <UpgradePrompt feature="modules" />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 * 
 * @example Logic branching
 * ```typescript
 * const { isEnabled: hasModules } = await checkFeature('modulesEnabled');
 * 
 * if (hasModules) {
 *   // Show full dashboard
 * } else {
 *   // Show basic view
 * }
 * ```
 */
export async function checkFeature(
  featureKey: keyof AccountEnabledFeatures
): Promise<{ 
  isEnabled: boolean; 
  profile: Awaited<ReturnType<typeof getCustomerProfile>> 
}> {
  const profile = await getCustomerProfile();
  const isEnabled = Boolean(profile?.enabledFeatures?.[featureKey]);
  
  return { isEnabled, profile };
}

/**
 * Server-side check for specific feature access result
 * 
 * Returns detailed information about feature access, including the profile
 * and a typed result. Useful when you need more control over the response.
 * 
 * @param featureKey - The feature to check
 * @returns Detailed feature access result
 * 
 * @example Detailed access check
 * ```typescript
 * const result = await checkFeatureAccess('modulesEnabled');
 * 
 * return (
 *   <div>
 *     <p>Feature: {result.feature}</p>
 *     <p>Enabled: {result.enabled ? 'Yes' : 'No'}</p>
 *     <p>Account: {result.profile?.name}</p>
 *   </div>
 * );
 * ```
 */
export async function checkFeatureAccess(
  featureKey: keyof AccountEnabledFeatures
): Promise<{
  feature: keyof AccountEnabledFeatures;
  enabled: boolean;
  profile: Awaited<ReturnType<typeof getCustomerProfile>>;
}> {
  const profile = await getCustomerProfile();
  const enabled = Boolean(profile?.enabledFeatures?.[featureKey]);
  
  return {
    feature: featureKey,
    enabled,
    profile
  };
}

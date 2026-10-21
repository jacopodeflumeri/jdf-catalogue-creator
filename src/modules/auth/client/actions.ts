/**
 * Magic Link Client Actions
 * 
 * Server actions that are safe to import in client components.
 * These wrap server-only functions to maintain proper client/server boundaries.
 * 
 * @module auth/client/actions
 */

'use server';

import { confirmMagicLinkToken } from '../server/magic-link-actions';

/**
 * Confirm magic link token from client component
 * 
 * This wrapper allows safe import in client components without bundling
 * server-only dependencies into the client bundle.
 * 
 * @param token - The magic link token to confirm and consume
 * @returns Promise with confirmation result including user data
 * 
 * @example Client component usage
 * ```tsx
 * 'use client';
 * import { confirmMagicLinkAction } from '@/modules/auth/client/actions';
 * 
 * function VerifyButton({ token }: { token: string }) {
 *   const handleConfirm = async () => {
 *     const result = await confirmMagicLinkAction(token);
 *     if (result.success) {
 *       // Proceed with authentication
 *     }
 *   };
 *   
 *   return <button onClick={handleConfirm}>Confirm Sign In</button>;
 * }
 * ```
 */
export async function confirmMagicLinkAction(token: string) {
  return confirmMagicLinkToken(token);
}

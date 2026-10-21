import { NextRequest } from 'next/server';
import { config } from '@/config';
import logger from '@/lib/utils/logger';

/**
 * Get the client IP address from the request
 * Handles various proxy headers and deployments
 */
export function getClientIP(request: NextRequest): string {
  // Check various headers for the real IP
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'x-client-ip',
    'cf-connecting-ip', // Cloudflare
    'true-client-ip',   // Cloudflare Enterprise
    'x-forwarded',
    'forwarded-for',
    'forwarded'
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const ip = value.split(',')[0].trim();
      if (ip && !isLocalhost(ip)) {
        return ip;
      }
    }
  }

  // Try to get IP from NextRequest.ip (available in some deployments)
  if ((request as any).ip && !isLocalhost((request as any).ip)) {
    return (request as any).ip;
  }

  // Check if we're in development and return a default IP for testing
  if (config.app.isDevelopment) {
    return '127.0.0.1'; // Use IPv4 localhost for consistency
  }

  // Final fallback
  return '127.0.0.1';
}

/**
 * Check if an IP is a localhost address (IPv4 or IPv6)
 */
function isLocalhost(ip: string): boolean {
  return ip === '127.0.0.1' || 
         ip === '::1' || 
         ip === 'localhost' || 
         ip.startsWith('127.') ||
         ip === '::ffff:127.0.0.1'; // IPv4-mapped IPv6 localhost
}

/**
 * Check if an IP address is in the allowed list
 */
export function isIPAllowed(ip: string): boolean {
  const { allowedIPs, enableIpCheck } = config.auth.restrictions;
  
  // If IP checking is disabled, allow all IPs
  if (!enableIpCheck) {
    return true;
  }
  
  // In development mode, allow localhost IPs
  if (config.app.isDevelopment && isLocalhost(ip)) {
    logger.log(`Development mode: allowing localhost IP ${ip}`);
    return true;
  }
  
  // If no IPs are configured, allow all (no restriction)
  if (!allowedIPs || allowedIPs.length === 0) {
    logger.log('No IP restrictions configured, allowing access');
    return true;
  }
  
  // Check if the IP is in the allowed list
  const isAllowed = allowedIPs.includes(ip);
  
  logger.log(`IP ${ip} ${isAllowed ? 'allowed' : 'blocked'} (allowed IPs: ${allowedIPs.join(', ')})`);
  
  return isAllowed;
}

/**
 * Check if admin access should be restricted to superadmins only
 */
export function isSuperAdminOnlyMode(): boolean {
  return config.auth.restrictions.superAdminOnly;
}

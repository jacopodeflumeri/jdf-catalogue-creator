import logger from '@/lib/utils/logger';
import { NextRequest, NextResponse } from 'next/server';
import { sendCustomerMagicLink } from '@/modules/auth/server';
import { withSecurity } from '@/lib/middleware/security';
import { config } from '@/config';

// Security configuration for magic link endpoint
const MAGIC_LINK_SECURITY_CONFIG = {
  allowedMethods: ['POST'],
  enableCSRF: true,
  rateLimit: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxAttempts: 5, // 5 requests per 5 minutes per IP
  },
  maxBodySize: 1024, // 1KB max body size
};

async function handleMagicLinkRequest(request: NextRequest) {
  try {
    // Magic-link is an optional capability, off by default. Refuse when disabled
    // so the endpoint can't be used when the app relies on Company Login only.
    if (!config.magicLink.enabled) {
      return NextResponse.json(
        { error: 'Magic-link authentication is not enabled' },
        { status: 404 },
      );
    }

    const { email, callbackUrl, firstName, lastName, userId } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Use the sendCustomerMagicLink utility function to generate and send magic link
    const result = await sendCustomerMagicLink(
      email,
      firstName || '',
      lastName || '',
      userId,
      undefined, // accountId
      callbackUrl || '/account',
      false // useAccountAction
    );

    logger.log('[send-magic-link] Magic link result for email:', email, result);

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: result.message
      });
    } else {
      return NextResponse.json({ 
        error: result.message 
      }, { status: 500 });
    }
  } catch (error) {
    logger.error('Magic link send error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// Apply security middleware with CSRF protection and rate limiting
export const POST = withSecurity(MAGIC_LINK_SECURITY_CONFIG)(handleMagicLinkRequest);
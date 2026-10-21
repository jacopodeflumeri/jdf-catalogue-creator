import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/modules/auth/config/nextauth';;
import { S3ImageService } from '@/modules/s3_images';
import logger from '@/lib/utils/logger';
import { validateFileUpload, checkRateLimit } from '@/lib/utils/security';
import { comprehensiveFileVerification } from '@/lib/utils/file-verification';
import { parsePathName, S3_PREFIXES, S3KeyError } from '@/modules/s3_images/config/prefixes';
import { authorizeS3Write } from '@/modules/s3_images/server/authorize';
import type { S3Image } from '@/types';

// Route segment config
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max execution time
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting - 10 uploads per minute per user
    const userKey = `upload_${session.user.email}`;
    const isAllowed = checkRateLimit(userKey, {
      windowMs: 60 * 1000, // 1 minute
      maxAttempts: 10
    });

    if (!isAllowed) {
      logger.warn('Upload rate limit exceeded', { user: session.user.email });
      return NextResponse.json({ 
        error: 'Too many upload attempts. Please wait a moment and try again.' 
      }, { status: 429 });
    }

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const generateVariants = formData.get('generateVariants') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // The destination used to be cast without checking, so an unrecognised
    // value produced a key literally beginning "undefined".
    let path;
    try {
      path = parsePathName(formData.get('path') ?? 'content');
    } catch (error) {
      if (error instanceof S3KeyError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    // This route admits any signed-in user, not just admins, so the prefix's
    // declared write level is what keeps a customer out of admin-write areas
    // such as mapp-team/.
    const callerLevel =
      session.user.role === 'admin' ? 'admin' : 'authenticated';
    const writeCheck = authorizeS3Write(S3_PREFIXES[path], callerLevel);
    if (!writeCheck.ok) {
      return NextResponse.json(
        { error: writeCheck.error },
        { status: writeCheck.status }
      );
    }

    // Basic file validation
    const basicValidation = validateFileUpload(file);
    if (!basicValidation.isValid) {
      return NextResponse.json({ error: basicValidation.error }, { status: 400 });
    }

    // Comprehensive file verification (content + extension + size)
    const verification = await comprehensiveFileVerification(file, 50 * 1024 * 1024); // 50MB max
    if (!verification.isValid) {
      logger.warn('File verification failed', { 
        filename: file.name,
        errors: verification.errors,
        user: session.user.email 
      });
      return NextResponse.json({ 
        error: `File verification failed: ${verification.errors.join(', ')}` 
      }, { status: 400 });
    }

    // Log warnings if any
    if (verification.warnings.length > 0) {
      logger.warn('File verification warnings', {
        filename: file.name,
        warnings: verification.warnings,
        user: session.user.email
      });
    }

    // Check if it's an image file
    const isImage = file.type.startsWith('image/');

    // Upload to S3
    const s3Service = S3ImageService.getInstance();
    
    if (isImage) {
      // Handle image uploads with processing
      const s3Image: S3Image = await s3Service.uploadImage(file, {
        path,
        generateVariants,
        metadata: {
          uploadedBy: session.user.email || 'admin',
          uploadedAt: new Date().toISOString(),
          originalName: file.name,
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      });

      logger.info('Image uploaded successfully:', {
        fileName: file.name,
        fileSize: file.size,
        s3Key: s3Image.key,
        uploadedBy: session.user.email
      });

      return NextResponse.json({
        success: true,
        image: s3Image,
        s3Image: s3Image, // Return as s3Image for consistency with components
        // Legacy compatibility for content blocks
        url: s3Image.url,
        filename: s3Image.name,
        size: s3Image.size,
        type: s3Image.type
      }, {
        headers: {
          'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; object-src 'none';",
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block'
        }
      });
    } else {
      // Handle non-image file uploads
      const s3File = await s3Service.uploadFile(file, {
        path,
        metadata: {
          uploadedBy: session.user.email || 'admin',
          uploadedAt: new Date().toISOString(),
          originalName: file.name,
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      });

      logger.info('File uploaded successfully:', {
        fileName: file.name,
        fileSize: file.size,
        s3Key: s3File.key,
        uploadedBy: session.user.email
      });

      return NextResponse.json({
        success: true,
        file: s3File,
        s3File: s3File, // Return as s3File for consistency with S3FileUpload component
        // Legacy compatibility for content blocks
        url: s3File.url,
        filename: s3File.name,
        size: s3File.size,
        type: s3File.type
      }, {
        headers: {
          'Content-Security-Policy': "default-src 'self'; object-src 'none';",
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block'
        }
      });
    }

  } catch (error) {
    logger.error('Upload failed:', error);
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Upload failed' 
    }, { status: 500 });
  }
}
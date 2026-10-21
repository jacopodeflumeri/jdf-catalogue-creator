/**
 * Secure file upload API route with S3 integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/modules/auth/server';
import { withSecurity } from '@/lib/middleware/security';
import { validateFileUpload } from '@/lib/utils/security';
import { parsePathName, S3_PREFIXES, S3KeyError } from '@/modules/s3_images/config/prefixes';
import { authorizeS3Write } from '@/modules/s3_images/server/authorize';
import { s3ImageService } from '@/modules/s3_images';
import logger from '@/lib/utils/logger';
import { config } from '@/config';

// Route segment config
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max execution time
export const dynamic = 'force-dynamic';

// Security configuration for file uploads
const UPLOAD_SECURITY_CONFIG = {
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxAttempts: 10, // 10 uploads per minute
  },
  allowedMethods: ['POST'],
  maxBodySize: config.build.s3.maxFileSize, // 100MB max (increased for large datasets)
};

async function handleFileUpload(req: NextRequest, session: any): Promise<NextResponse> {
  try {
    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    let uploadPath;
    try {
      uploadPath = parsePathName(formData.get('path') ?? 'content');
    } catch (error) {
      if (error instanceof S3KeyError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    // This route is already admin-gated by withAdminAuth, so this always
    // passes today. It is here so a prefix that later demands more than admin
    // is enforced rather than silently ignored.
    const writeCheck = authorizeS3Write(S3_PREFIXES[uploadPath], 'admin');
    if (!writeCheck.ok) {
      return NextResponse.json(
        { error: writeCheck.error },
        { status: writeCheck.status }
      );
    }
    const generateVariants = formData.get('generateVariants') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file security
    const validation = validateFileUpload(file);
    if (!validation.isValid) {
      logger.warn('Security event: invalid file upload attempt', {
        filename: file.name,
        size: file.size,
        type: file.type,
        error: validation.error,
        userId: session.user.id
      });

      return NextResponse.json({ 
        error: validation.error || 'Invalid file' 
      }, { status: 400 });
    }

    // Additional file type validation for images
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip', 'application/x-rar-compressed',
      'video/mp4', 'video/quicktime',
      'audio/mpeg', 'audio/wav'
    ];

    if (!allowedTypes.includes(file.type)) {
      logger.warn('Security event: blocked file type upload', {
        filename: file.name,
        type: file.type,
        userId: session.user.id
      });

      return NextResponse.json({ 
        error: 'File type not allowed' 
      }, { status: 400 });
    }

    // Check if it's an image for S3 processing
    const isImage = file.type.startsWith('image/');
    
    if (isImage) {
      // Use S3 service for image uploads with processing

      const s3Image = await s3ImageService.uploadImage(file, {
        path: uploadPath,
        generateVariants,
        metadata: {
          uploadedBy: session.user.email || session.user.id,
          originalName: file.name,
        }
      });

      logger.log('Image uploaded to S3 successfully:', {
        filename: file.name,
        size: file.size,
        s3Key: s3Image.key,
        userId: session.user.id
      });

      return NextResponse.json({
        success: true,
        image: s3Image,
        // Legacy compatibility
        url: s3Image.url,
        filename: s3Image.name,
        size: s3Image.size,
        type: s3Image.type
      });
    } else {
      // For non-image files, upload to S3 without image processing

      const s3File = await s3ImageService.uploadFile(file, {
        path: uploadPath,
        metadata: {
          uploadedBy: session.user.email || session.user.id,
          originalName: file.name,
        }
      });

      logger.log('File uploaded to S3 successfully:', {
        filename: file.name,
        size: file.size,
        s3Key: s3File.key,
        userId: session.user.id
      });

      return NextResponse.json({
        success: true,
        file: s3File,
        // Legacy compatibility
        url: s3File.url,
        filename: s3File.name,
        size: s3File.size,
        type: s3File.type
      });
    }

  } catch (error) {
    logger.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}

// Apply security middleware and auth
export const POST = withSecurity(UPLOAD_SECURITY_CONFIG)(
  withAdminAuth(async (req: NextRequest, { session }) => {
    return handleFileUpload(req, session);
  })
);

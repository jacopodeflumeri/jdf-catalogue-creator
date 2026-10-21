/**
 * AWS S3 Image Service
 * Handles all S3 operations for image storage, processing, and retrieval
 * 
 * ⚠️ SERVER-ONLY: This file uses 'sharp' (Node.js image processing) and must only be imported server-side
 */

import { randomUUID } from 'crypto';
import { S3Client, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import sharp from 'sharp';
import { getS3Config, validateS3Config } from '../config/s3-config';
import { resolveS3Key, type S3PathName } from '../config/prefixes';
import { shouldConvertToWebP, estimateWebPSavings } from '@/modules/s3_images/utils/image-optimization';
import type { S3Image, S3File } from '../types';
import logger from '@/lib/utils/logger';

export class S3ImageService {
  private static instance: S3ImageService;
  private s3Client: S3Client;
  private config: ReturnType<typeof getS3Config>;
  private available: boolean = false;

  constructor() {
    const validation = validateS3Config();
    this.available = validation.isValid;
    
    if (!this.available) {
      logger.warn('S3 configuration invalid, S3 features will be disabled:', validation.errors.join(', '));
      // Still need to initialize with dummy config to prevent runtime errors
      this.config = getS3Config();
      this.s3Client = new S3Client({
        region: this.config.region || 'us-east-1',
        credentials: {
          accessKeyId: this.config.accessKeyId || 'dummy',
          secretAccessKey: this.config.secretAccessKey || 'dummy',
        },
      });
      return;
    }

    this.config = getS3Config();
    this.s3Client = new S3Client({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId!,
        secretAccessKey: this.config.secretAccessKey!,
      },
    });
  }

  static getInstance(): S3ImageService {
    if (!S3ImageService.instance) {
      S3ImageService.instance = new S3ImageService();
    }
    return S3ImageService.instance;
  }

  /**
   * Check if S3 service is available and properly configured
   */
  isS3Available(): boolean {
    return this.available;
  }

  /**
   * Upload an image file to S3 with automatic processing and variants
   */
  async uploadImage(
    file: File | Buffer,
    options: {
      path: S3PathName;
      filename?: string;
      generateVariants?: boolean;
      metadata?: Record<string, string>;
    }
  ): Promise<S3Image> {
    if (!this.available) {
      throw new Error('S3 service is not available. Please check your S3 configuration.');
    }
    
    try {
      // Convert File to Buffer if needed
      const buffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file;
      const originalFilename = file instanceof File ? file.name : options.filename || 'image';
      const mimeType = file instanceof File ? file.type : this.getMimeTypeFromBuffer(buffer);

      // Validate file type
      if (!this.config.imageProcessing.allowedTypes.includes(mimeType as any)) {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }

      // Validate file size
      if (buffer.length > this.config.imageProcessing.maxFileSize) {
        throw new Error(`File too large: ${buffer.length} bytes (max: ${this.config.imageProcessing.maxFileSize})`);
      }

      // Check if we should convert to WebP
      const shouldConvert = shouldConvertToWebP(mimeType, buffer.length);
      if (shouldConvert) {
        const savings = estimateWebPSavings(buffer.length);
        logger.log(`Converting image to WebP. Estimated savings: ${savings.savingsPercent}%. JPEG fallback quality: ${this.config.imageProcessing.quality.jpeg}%`);
      } else {
        logger.log(`Skipping WebP conversion (${mimeType}, ${(buffer.length / 1024).toFixed(1)}KB). Using high-quality JPEG: ${this.config.imageProcessing.quality.jpegPrimary}%`);
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomId = randomUUID().slice(0, 8);
      const extension = this.getExtensionFromMimeType(mimeType);
      const uniqueFilename = `${timestamp}-${randomId}-${this.sanitizeFilename(originalFilename)}.${extension}`;
      
      // Generate S3 key
      const s3Key = `${this.config.paths[options.path]}${uniqueFilename}`;

      // Generate format variants (WebP + JPEG fallback) only if beneficial
      const formats = await this.generateFormatVariants(
        buffer, 
        s3Key, 
        uniqueFilename, 
        options.path, 
        {
          originalFilename,
          ...options.metadata,
        },
        shouldConvert
      );

      // Generate size variants if requested
      const variants: Record<string, string> = {};
      if (options.generateVariants) {
        for (const [variantName, variantConfig] of Object.entries(this.config.imageProcessing.variants)) {
          try {
            // Determine variant quality strategy (same as main image)
            const variantJpegQuality = shouldConvert 
              ? this.config.imageProcessing.quality.jpeg        // 70% - when WebP variants available
              : this.config.imageProcessing.quality.jpegPrimary; // 90% - when JPEG is primary

            // Generate WebP variant if main image supports WebP
            if (shouldConvert) {
              const webpVariantBuffer = await sharp(buffer)
                .resize(variantConfig.width, variantConfig.height, { fit: variantConfig.fit })
                .webp({ quality: this.config.imageProcessing.quality.webp })
                .toBuffer();

              const webpVariantKey = `${this.config.paths[options.path]}variants/${variantName}/${uniqueFilename.replace(/\.(jpe?g|png)$/i, '.webp')}`;
              await this.uploadToS3(webpVariantBuffer, webpVariantKey, 'image/webp');
              variants[`${variantName}-webp`] = this.getPublicUrl(webpVariantKey);
            }

            // Generate JPEG variant (always generated, quality depends on WebP availability)
            const jpegVariantBuffer = await sharp(buffer)
              .resize(variantConfig.width, variantConfig.height, { fit: variantConfig.fit })
              .jpeg({ quality: variantJpegQuality })
              .toBuffer();

            const jpegVariantKey = `${this.config.paths[options.path]}variants/${variantName}/${uniqueFilename.replace(/\.(webp|png)$/i, '.jpg')}`;
            await this.uploadToS3(jpegVariantBuffer, jpegVariantKey, 'image/jpeg');
            variants[`${variantName}-jpeg`] = this.getPublicUrl(jpegVariantKey);
          } catch (variantError) {
            logger.warn(`Failed to generate ${variantName} variant:`, variantError);
          }
        }
      }

      // Create S3Image object
      const primaryUrl = formats.webp || formats.jpeg;
      const primaryFormat = formats.webp ? 'webp' : 'jpeg';
      const primaryKey = formats.webp ? formats.webpKey : formats.jpegKey;
      const primarySize = formats.webp ? formats.webpSize : formats.jpegSize;

      const s3Image: S3Image = {
        url: primaryUrl, // Primary URL (WebP if available, otherwise JPEG)
        bucket: this.config.bucket,
        key: primaryKey,
        name: originalFilename,
        type: `image/${primaryFormat}`,
        size: primarySize,
        access: 'public',
        metadata: {
          width: formats.metadata.width,
          height: formats.metadata.height,
          format: primaryFormat,
          uploadedAt: new Date().toISOString(),
        },
        formats: {
          ...(formats.webp && { webp: formats.webp }),
          jpeg: formats.jpeg,
          original: formats.original,
        },
        ...(Object.keys(variants).length > 0 && { variants }),
      };

      logger.log('Image uploaded successfully:', {
        webpKey: formats.webpKey,
        jpegKey: formats.jpegKey,
        webpSize: formats.webpSize,
        jpegSize: formats.jpegSize,
        variants: Object.keys(variants),
      });

      return s3Image;

    } catch (error) {
      logger.error('Failed to upload image:', error);
      throw new Error(`Image upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload any file type to S3 (without image processing)
   */
  async uploadFile(
    file: File | Buffer,
    options: {
      path: S3PathName;
      filename?: string;
      metadata?: Record<string, string>;
      contentEncoding?: string;
    }
  ): Promise<S3File> {
    if (!this.available) {
      throw new Error('S3 service is not available. Please check your S3 configuration.');
    }
    
    try {
      // Convert File to Buffer if needed
      const buffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file;
      const originalFilename = file instanceof File ? file.name : options.filename || 'file';
      const mimeType = file instanceof File ? file.type : this.getMimeTypeFromBuffer(buffer);

      // Validate file size
      if (buffer.length > this.config.imageProcessing.maxFileSize) {
        throw new Error(`File too large: ${buffer.length} bytes (max: ${this.config.imageProcessing.maxFileSize})`);
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomId = randomUUID().slice(0, 8);
      const extension = this.getExtensionFromMimeType(mimeType) || this.getExtensionFromFilename(originalFilename);
      const uniqueFilename = `${timestamp}-${randomId}-${this.sanitizeFilename(originalFilename)}.${extension}`;
      
      // Generate S3 key
      const s3Key = `${this.config.paths[options.path]}${uniqueFilename}`;

      // Upload file directly without processing
      await this.uploadToS3(buffer, s3Key, mimeType, {
        originalFilename,
        size: buffer.length.toString(),
        ...options.metadata,
      }, options.contentEncoding);

      // Create S3File object for non-image files
      const s3File: S3File = {
        url: this.getPublicUrl(s3Key),
        bucket: this.config.bucket,
        key: s3Key,
        name: originalFilename,
        type: mimeType,
        size: buffer.length,
        access: 'public',
        metadata: {
          uploadedAt: new Date().toISOString(),
          originalName: originalFilename,
          ...options.metadata,
        },
      };

      logger.log('File uploaded successfully:', {
        key: s3Key,
        size: buffer.length,
        type: mimeType,
      });

      return s3File;

    } catch (error) {
      logger.error('Failed to upload file:', error);
      throw new Error(`File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete an image and all its variants from S3
   */
  async deleteImage(s3Image: S3Image): Promise<void> {
    if (!this.available) {
      throw new Error('S3 service is not available. Please check your S3 configuration.');
    }
    
    try {
      if (!s3Image.key) {
        throw new Error('S3 key is required for deletion');
      }

      // Delete main image
      await this.deleteFromS3(s3Image.key);

      // Delete variants
      if (s3Image.variants) {
        for (const variantUrl of Object.values(s3Image.variants)) {
          const variantKey = this.extractKeyFromUrl(variantUrl);
          if (variantKey) {
            await this.deleteFromS3(variantKey);
          }
        }
      }

      logger.log('Image deleted successfully:', s3Image.key);
    } catch (error) {
      logger.error('Failed to delete image:', error);
      throw new Error(`Image deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a presigned URL for private access
   */
  async getPresignedUrl(key: string, expiresIn: number = this.config.presignedUrl.expiresIn): Promise<string> {
    if (!this.available) {
      throw new Error('S3 service is not available. Please check your S3 configuration.');
    }

    // Validate here as well as in the routes. A presigned URL bypasses the app
    // entirely once issued, so the service must not mint one for an arbitrary
    // key just because some future caller forgot to check. Throws S3KeyError.
    resolveS3Key(key);

    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      logger.error('Failed to generate presigned URL:', error);
      throw new Error('Failed to generate presigned URL');
    }
  }

  /**
   * Check if an image exists in S3
   */
  async imageExists(key: string): Promise<boolean> {
    if (!this.available) {
      return false;
    }
    
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });
      
      await this.s3Client.send(command);
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get public URL for an image
   */
  private getPublicUrl(key: string): string {
    if (this.config.cdn.enabled && this.config.cdn.domain) {
      return `https://${this.config.cdn.domain}/${key}`;
    }
    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
  }

  /**
   * Process and optimize image
   */
  private async processImage(buffer: Buffer, mimeType: string): Promise<{
    buffer: Buffer;
    metadata: { width?: number; height?: number; format?: string };
  }> {
    try {
      let sharpInstance = sharp(buffer);
      const metadata = await sharpInstance.metadata();

      // Apply optimization based on format
      switch (mimeType) {
        case 'image/jpeg':
        case 'image/jpg':
          sharpInstance = sharpInstance.jpeg({ quality: this.config.imageProcessing.quality.jpeg });
          break;
        case 'image/png':
          sharpInstance = sharpInstance.png({ compressionLevel: this.config.imageProcessing.quality.png });
          break;
        case 'image/webp':
          sharpInstance = sharpInstance.webp({ quality: this.config.imageProcessing.quality.webp });
          break;
        default:
          // Keep original format for other types (GIF, SVG)
          break;
      }

      const processedBuffer = await sharpInstance.toBuffer();

      return {
        buffer: processedBuffer,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
        },
      };
    } catch (error) {
      logger.warn('Failed to process image, using original:', error);
      return {
        buffer,
        metadata: {},
      };
    }
  }

  /**
   * Upload buffer to S3
   */
  private async uploadToS3(
    buffer: Buffer,
    key: string,
    contentType: string,
    metadata: Record<string, string> = {},
    contentEncoding?: string
  ): Promise<void> {
    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.config.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
        CacheControl: 'max-age=31536000', // 1 year
        ...(contentEncoding && { ContentEncoding: contentEncoding }),
      },
    });

    await upload.done();
  }

  /**
   * Delete object from S3
   */
  private async deleteFromS3(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  /**
   * Extract S3 key from URL
   */
  private extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      
      // Handle CDN URLs
      if (this.config.cdn.enabled && urlObj.hostname === this.config.cdn.domain) {
        return urlObj.pathname.substring(1); // Remove leading slash
      }
      
      // Handle direct S3 URLs
      if (urlObj.hostname.includes('s3') && this.config.bucket && urlObj.hostname.includes(this.config.bucket)) {
        return urlObj.pathname.substring(1); // Remove leading slash
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Generate WebP and JPEG format variants
   */
  private async generateFormatVariants(
    buffer: Buffer,
    baseKey: string,
    filename: string,
    path: S3PathName,
    metadata: Record<string, string> = {},
    shouldConvertToWebP: boolean = true
  ): Promise<{
    webp: string;
    jpeg: string;
    original: string;
    webpKey: string;
    jpegKey: string;
    webpSize: number;
    jpegSize: number;
    metadata: { width?: number; height?: number };
  }> {
    const sharpInstance = sharp(buffer);
    const imageMetadata = await sharpInstance.metadata();

    let webpBuffer: Buffer | null = null;
    let webpKey = '';
    let webpSize = 0;

    // Generate WebP format only if beneficial
    if (shouldConvertToWebP) {
      webpBuffer = await sharp(buffer)
        .webp({ quality: this.config.imageProcessing.quality.webp })
        .toBuffer();
      
      webpKey = `${this.config.paths[path]}${filename.replace(/\.(jpe?g|png)$/i, '.webp')}`;
      await this.uploadToS3(webpBuffer, webpKey, 'image/webp', {
        ...metadata,
        format: 'webp',
        size: webpBuffer.length.toString(),
        width: imageMetadata.width?.toString() || '',
        height: imageMetadata.height?.toString() || '',
      });
      webpSize = webpBuffer.length;
    }

    // Generate JPEG format with adaptive quality
    // If WebP is available, use lower JPEG quality (it's just a fallback)
    // If no WebP, use higher JPEG quality (it's the primary format)
    const jpegQuality = shouldConvertToWebP && webpBuffer 
      ? this.config.imageProcessing.quality.jpeg        // 70% - fallback quality
      : this.config.imageProcessing.quality.jpegPrimary; // 90% - primary quality
    
    const jpegBuffer = await sharp(buffer)
      .jpeg({ quality: jpegQuality })
      .toBuffer();
    
    const jpegKey = `${this.config.paths[path]}${filename.replace(/\.(webp|png)$/i, '.jpg')}`;
    await this.uploadToS3(jpegBuffer, jpegKey, 'image/jpeg', {
      ...metadata,
      format: 'jpeg',
      size: jpegBuffer.length.toString(),
      width: imageMetadata.width?.toString() || '',
      height: imageMetadata.height?.toString() || '',
    });

    // Keep original if it's not JPEG/WebP already
    let originalUrl = this.getPublicUrl(webpKey); // Default to WebP
    const originalMimeType = this.getMimeTypeFromBuffer(buffer);
    if (!['image/jpeg', 'image/webp'].includes(originalMimeType)) {
      const originalKey = baseKey; // Use original key for PNG/GIF/etc
      await this.uploadToS3(buffer, originalKey, originalMimeType, {
        ...metadata,
        format: originalMimeType.split('/')[1],
        size: buffer.length.toString(),
        width: imageMetadata.width?.toString() || '',
        height: imageMetadata.height?.toString() || '',
      });
      originalUrl = this.getPublicUrl(originalKey);
    }

    return {
      webp: webpKey ? this.getPublicUrl(webpKey) : '',
      jpeg: this.getPublicUrl(jpegKey),
      original: originalUrl,
      webpKey: webpKey || '',
      jpegKey,
      webpSize,
      jpegSize: jpegBuffer.length,
      metadata: {
        width: imageMetadata.width,
        height: imageMetadata.height,
      },
    };
  }

  /**
   * Utility methods
   */
  private getMimeTypeFromBuffer(buffer: Buffer): string {
    // Simple magic number detection
    const magic = buffer.slice(0, 4).toString('hex');
    
    if (magic.startsWith('ffd8ff')) return 'image/jpeg';
    if (magic.startsWith('89504e47')) return 'image/png';
    if (magic.startsWith('47494638')) return 'image/gif';
    if (magic.startsWith('52494646')) return 'image/webp';
    
    return 'application/octet-stream';
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/zip': 'zip',
      'application/x-rar-compressed': 'rar',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
    };
    
    return map[mimeType] || 'bin';
  }

  private getExtensionFromFilename(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return 'bin';
    return filename.substring(lastDot + 1).toLowerCase();
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }
}

// Export singleton instance
export const s3ImageService = S3ImageService.getInstance();
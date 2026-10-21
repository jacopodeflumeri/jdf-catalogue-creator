/**
 * S3 Images Module - Public API
 * 
 * Handles all S3 operations for images and files including:
 * - Image uploads with automatic WebP conversion and variants
 * - File uploads for documents and other non-image content
 * - Presigned URL generation for secure access
 * - Image optimization and format selection
 * 
 * @example
 * ```typescript
 * import { S3ImageService, S3ImageUpload, type S3Image } from '@/modules/s3_images'
 * 
 * // Use the service
 * const service = S3ImageService.getInstance()
 * const image = await service.uploadImage(file, { path: 'content' })
 * 
 * // Use the component
 * <S3ImageUpload onUploadComplete={(image) => logger.log(image)} />
 * ```
 */

// ===== SERVICES =====
export { S3ImageService, s3ImageService } from './services/s3-image-service';

// ===== UTILITIES =====
export {
  detectWebPSupportFromHeaders,
  getOptimalImageUrl,
  getImageFormatStats,
  estimateWebPSavings,
  shouldConvertToWebP,
} from './utils/image-optimization';

export {
  normalizeImageToS3Format,
  getImageUrl,
  createS3Image,
  isS3Image,
  addImageVariants,
  createS3ImageFromUpload,
  stringToS3Image,
  s3ImageToJson,
  jsonToS3Image,
  transformImageForResponse,
  normalizeImageInput,
  getImageDisplayUrl,
} from './utils/image-utils';

// ===== COMPONENTS =====
export { default as S3ImageUpload } from './components/S3ImageUpload';
export { default as S3FileUpload } from './components/S3FileUpload';
export { default as S3ImageDisplay } from './components/S3ImageDisplay';

// ===== TYPES =====
export type {
  S3Object,
  S3Image,
  S3File,
  UploadImageOptions,
  UploadFileOptions,
  UploadResult,
  ImageVariant,
  ImageVariantConfig,
  S3ServiceConfig,
  PresignedUrlParams,
} from './types';

// ===== VALIDATION =====
export {
  s3ImageSchema,
  imageFieldSchema,
  s3FileSchema,
  fileFieldSchema,
  uploadOptionsSchema,
  fileUploadSchema,
  presignedUrlParamsSchema,
} from './validation/schemas';

export type {
  S3ImageValidation,
  S3FileValidation,
  UploadOptionsValidation,
  PresignedUrlParamsValidation,
} from './validation/schemas';

// ===== CONFIGURATION =====
export { S3_CONFIG, validateS3Config, getS3Config, isS3Available } from './config/s3-config';

// ===== HANDLERS (To be created in Phase 4) =====
// export { handleAuthenticatedUpload, handlePublicUpload } from './handlers/upload-handler';
// export { getImageUrl, getImageVariant } from './handlers/images-handler';
// export { getFileUrl, downloadFile } from './handlers/files-handler';

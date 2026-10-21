'use client';

import { InputHTMLAttributes, useState } from 'react';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Loading from '@/components/ui/Loading';
import S3ImageDisplay from './S3ImageDisplay';
import logger from '@/lib/utils/logger';
import type { S3Image } from '../types';

interface S3ImageUploadProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'placeholder' | 'size' | 'value'> {
  label?: string;
  value?: S3Image | null; // Current S3Image object
  onChange: (s3Image: S3Image | null) => void; // Changed to return S3Image instead of base64
  onUploadStateChange?: (isUploading: boolean) => void; // Callback to notify parent of upload state
  preview?: string | null; // Preview image (base64)
  containerClassName?: string;
  imageClassName?: string;
  placeholder?: React.ReactNode;
  maxSize?: number; // Max file size in MB
  acceptedTypes?: string[];
  helpText?: string;
  techText?: string;
  error?: string;
  variant?: 'square' | 'circle' | 'rectangle';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showRemove?: boolean;
  uploadPath?: 'content' | 'mappTeam' | 'temp'; // S3 upload path
  generateVariants?: boolean; // Whether to generate image variants
}

const S3ImageUpload: React.FC<S3ImageUploadProps> = ({
  label,
  value,
  onChange,
  onUploadStateChange,
  preview,
  containerClassName,
  imageClassName,
  placeholder,
  maxSize = 10,
  acceptedTypes = ['image/*'],
  helpText,
  techText,
  error,
  variant = 'rectangle',
  size = 'md',
  showRemove = true,
  uploadPath = 'content',
  generateVariants = true,
  ...props
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Remove localPreview - we'll show loading overlay on existing image instead

  // Size classes
  const sizeClasses = {
    sm: variant === 'circle' || variant === 'square' ? 'h-16 w-16' : 'h-24 w-full',
    md: variant === 'circle' || variant === 'square' ? 'h-24 w-24' : 'h-32 w-full',
    lg: variant === 'circle' || variant === 'square' ? 'h-32 w-32' : 'h-48 w-full',
    xl: variant === 'circle' || variant === 'square' ? 'h-48 w-48' : 'h-64 w-full'
  };

  // Responsive overlay content based on size
  const overlayClasses = {
    sm: { iconSize: 'w-3 h-3', textSize: 'text-xs', gap: 'gap-1', padding: 'p-1' },
    md: { iconSize: 'w-5 h-5', textSize: 'text-xs', gap: 'gap-2', padding: 'p-2' },
    lg: { iconSize: 'w-5 h-5', textSize: 'text-xs', gap: 'gap-3', padding: 'p-2' },
    xl: { iconSize: 'w-6 h-6', textSize: 'text-sm', gap: 'gap-4', padding: 'p-3' }
  };

  // Variant classes
  const variantClasses = {
    square: 'rounded-xl',
    circle: 'rounded-full',
    rectangle: 'rounded-xl'
  };

  const hasImage = !!(preview || value);
  const isLoading = uploading;

  const baseContainerClasses = `
    ${isLoading ? '' : 'group'} relative flex flex-col items-center justify-center 
    transition-all duration-300 ease-in-out
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    ${containerClassName || ''}
  `;

  const dragClasses = dragOver
    ? 'border-primary-500 bg-primary-50'
    : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100';

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFile = async (file: File, attempt: number = 1) => {
    // Validate file type
    if (!acceptedTypes.some(type => {
      if (type === 'image/*') return file.type.startsWith('image/');
      return file.type === type;
    })) {
      alert(`File type not allowed. Please select: ${acceptedTypes.join(', ')}`);
      return;
    }

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      alert(`File too large. Maximum size is ${maxSize}MB`);
      return;
    }

    // Don't show local preview - keep existing image with loading overlay
    // This prevents the flashing behavior during upload

    // Upload to S3
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    onUploadStateChange?.(true); // Notify parent that upload started

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', uploadPath);
      formData.append('generateVariants', generateVariants.toString());

      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();

      // Progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      // Upload promise
      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve(result);
            } catch (_error) {
              reject(new Error('Invalid response format'));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.error || `Upload failed with status ${xhr.status}`));
            } catch (_error) {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('timeout', () => {
          reject(new Error('Upload timeout'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        xhr.open('POST', '/api/upload');
        xhr.timeout = 300000; // 5 minute timeout
        xhr.send(formData);
      });

      const result = await uploadPromise;

      // Handle image uploads - API returns image field for images
      const s3Image = result.image || result.s3Image;
      onChange(s3Image); // Return S3Image object
      setRetryCount(0); // Reset retry count on success

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadError(errorMessage);

      // Retry logic for network errors
      if (attempt < 3 && (errorMessage.includes('Network') || errorMessage.includes('timeout'))) {
        logger.warn(`Upload attempt ${attempt} failed, retrying...`, { error: errorMessage });
        setRetryCount(attempt);
        setTimeout(() => {
          handleFile(file, attempt + 1);
        }, 1000 * attempt); // Exponential backoff
      } else {
        logger.error('Upload failed after retries:', error);
        alert(errorMessage);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      onUploadStateChange?.(false); // Notify parent that upload finished
    }
  };

  return (
    <div className={`space-y-2 ${containerClassName || ''}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <div
        className={`
          ${baseContainerClasses} 
          ${hasImage ? 'border-gray-200 bg-gray-25' : dragClasses}
          ${uploading ? 'pointer-events-none opacity-75' : ''}
          ${error ? 'border-red-500 ring-red-500' : 'border-gray-300'}
          ${variant === 'circle' ? 'rounded-full' : 'rounded-lg'}
          border-2 border-dashed transition-all duration-200 cursor-pointer
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => document.getElementById('image-upload-input')?.click()}
      >
        <input
          id="image-upload-input"
          type="file"
          className="hidden"
          accept={acceptedTypes.join(',')}
          onChange={handleInputChange}
          disabled={uploading}
          {...props}
        />

        {uploading ? (
          <div className="text-center space-y-3 p-4">
            <Loading text={retryCount > 0 ? `Retrying upload... (${retryCount}/3)` : "Uploading image..."} />
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-600">{uploadProgress}% complete</p>
            {uploadError && (
              <p className="text-xs text-red-600 mt-2">{uploadError}</p>
            )}
          </div>
        ) : hasImage ? (
          <div className={`relative ${sizeClasses[size]} ${variantClasses[variant]} overflow-hidden w-full`}>
            {preview ? (
              // Show preview image (base64 from parent component)
              <img
                src={preview}
                alt="Upload preview"
                className={`w-full h-full object-cover ${imageClassName || ''}`}
              />
            ) : (
              // Show S3Image with presigned URL
              <S3ImageDisplay
                s3Image={value}
                alt="Current image"
                fill
                className={`object-cover ${imageClassName || ''}`}
                fallback={placeholder}
              />
            )}

            {/* Overlay - shows on hover */}
            <div className={`absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 ${variantClasses[variant]} pointer-events-none`}>
              {size === 'sm' ? (
                // Simplified overlay for small sizes - just icons
                <div className="flex items-center gap-1">
                  <div className="text-white cursor-pointer pointer-events-none" title="Change image">
                    <Icon type="camera" size="sm" className="text-white" />
                  </div>
                </div>
              ) : (
                // Full overlay for larger sizes
                <div className={`flex items-center ${overlayClasses[size].gap}`}>
                  <div className="text-center text-white pointer-events-none leading-3">
                    <Icon type="camera" size={size === 'xl' ? 'lg' : 'md'} className="mx-auto text-white" />
                    <span className={overlayClasses[size].textSize}>Change</span>
                  </div>
                </div>
              )}
            </div>

            {/* Remove button - positioned separately with highest z-index */}
            {showRemove && (
              <Button
                type="button"
                onClick={() => onChange(null)}
                variant="overrideNoBorder"
                size={size === 'sm' || size === 'md' ? 'xxs' : 'xs'}
                className={`${variant === 'circle' ? 'absolute top-4 left-1/2 transform -translate-x-1/2 -translate-y-1/2' : 'absolute top-2 right-2'} bg-red-500 hover:bg-red-600 text-white rounded-full p-0 opacity-0 group-hover:opacity-100 transition-all duration-300 z-30`}
                title="Remove image"
              >
                <Icon type="x" size={size === 'sm' || size === 'md' ? 'xs' : 'sm'} />
              </Button>
            )}
          </div>
        ) : (
          // Show upload prompt
          <div className="text-center p-4">
            {size !== 'lg' ? (
              <>
                <Icon type="upload" size='md' className='mx-auto text-gray-400 mb-2' />
                <p className="text-xs font-medium text-gray-600">
                  Click to upload
                </p>
              </>
            ) : (
              <>
                <Icon type="upload" className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm font-medium text-gray-600">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {acceptedTypes.includes('image/*') ? 'Images (JPG, PNG, GIF, WebP)' : acceptedTypes.join(', ')}
                </p>
                {maxSize && (
                  <p className="text-xs text-gray-400 mt-1">
                    Max size: {maxSize}MB
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Help text */}
      {(helpText || techText) && (
        <div className="space-y-1">
          {helpText && (
            <p className="text-sm text-gray-600">{helpText}</p>
          )}
          {techText && (
            <p className="text-xs text-gray-500">{techText}</p>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default S3ImageUpload;
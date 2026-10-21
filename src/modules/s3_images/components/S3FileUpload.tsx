'use client';

import { InputHTMLAttributes, useState } from 'react';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Loading from '@/components/ui/Loading';
import logger from '@/lib/utils/logger';
import type { S3File } from '../types';

interface S3FileUploadProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'placeholder' | 'size' | 'value'> {
  label?: string;
  value?: S3File | null; // Current S3File object
  filename?: string; // Display name of the current file
  onChange: (s3File: S3File | null) => void; // Return S3File instead of base64
  onUploadStateChange?: (isUploading: boolean) => void; // Callback to notify parent of upload state
  containerClassName?: string;
  placeholder?: React.ReactNode;
  maxSize?: number; // Max file size in MB
  acceptedTypes?: string[]; // File type restrictions
  helpText?: string;
  error?: string;
  showRemove?: boolean;
  uploadPath?: 'content' | 'mappTeam' | 'temp'; // S3 upload path
}

/**
 * Get file type from filename for icon display
 */
function getFileType(filename: string): 'pdf' | 'ppt' | 'doc' | 'other' {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'pdf';
  if (['ppt', 'pptx'].includes(extension || '')) return 'ppt';
  if (['doc', 'docx'].includes(extension || '')) return 'doc';
  return 'other';
}

/**
 * Get icon type for file based on file type
 */
function getFileIcon(fileType: 'pdf' | 'ppt' | 'doc' | 'other'): 'content' | 'database' | 'folder' {
  switch (fileType) {
    case 'pdf': return 'content';
    case 'ppt': return 'database'; // Use database icon for presentations
    case 'doc': return 'folder'; // Use folder icon for documents  
    default: return 'content';
  }
}

/**
 * S3FileUpload - Handles secure upload of files to S3
 * 
 * This component automatically uploads files to S3 and returns S3Image objects
 * for secure access without requiring public bucket permissions.
 */
export default function S3FileUpload({
  label,
  value,
  filename,
  onChange,
  onUploadStateChange,
  containerClassName,
  placeholder,
  maxSize = 50, // Default 50MB for files
  acceptedTypes = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.zip', '.rar', '.7z', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.mp4', '.avi', '.mov', '.mp3', '.wav'],
  helpText,
  error,
  showRemove = true,
  uploadPath = 'content',
  ...props
}: S3FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const hasFile = !!(value && filename);

  const handleFileSelect = (file: File) => {
    if (!file) return;

    // Validate file size
    if (maxSize && file.size > maxSize * 1024 * 1024) {
      alert(`File size must be less than ${maxSize}MB`);
      return;
    }

    uploadFile(file);
  };

  const uploadFile = async (file: File, attempt: number = 1) => {
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    onUploadStateChange?.(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', uploadPath);
      formData.append('generateVariants', 'false'); // Files don't need image variants

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
      
      // Handle file uploads - API returns s3File field for files
      const s3File = result.s3File || result.file;
      onChange(s3File);
      setRetryCount(0); // Reset retry count on success
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadError(errorMessage);
      
      // Retry logic for network errors
      if (attempt < 3 && (errorMessage.includes('Network') || errorMessage.includes('timeout'))) {
        logger.warn(`Upload attempt ${attempt} failed, retrying...`, { error: errorMessage });
        setRetryCount(attempt);
        setTimeout(() => {
          uploadFile(file, attempt + 1);
        }, 1000 * attempt); // Exponential backoff
      } else {
        logger.error('Upload failed after retries:', error);
        alert(errorMessage);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      onUploadStateChange?.(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    if (file) {
      handleFileSelect(file);
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
      handleFileSelect(file);
    }
    // Reset input value to allow re-uploading same file
    e.target.value = '';
  };

  const handleRemove = () => {
    onChange(null);
  };

  const errorClasses = error ? 'border-red-500 ring-red-500' : 'border-gray-300';
  const dragClasses = dragOver 
    ? 'border-primary-500 bg-primary-50' 
    : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100';

  return (
    <div className={`space-y-2 ${containerClassName || ''}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      
      <div className="space-y-3">
        {/* Upload Area */}
        <div 
          className={`
            relative border-2 border-dashed rounded-lg p-4 transition-all duration-200 cursor-pointer
            ${hasFile ? 'border-gray-200 bg-gray-25' : dragClasses}
            ${uploading ? 'pointer-events-none opacity-75' : ''}
            ${errorClasses}
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById('file-upload-input')?.click()}
        >
          <input
            id="file-upload-input"
            type="file"
            className="hidden"
            accept={acceptedTypes.join(',')}
            onChange={handleInputChange}
            disabled={uploading}
            {...props}
          />
          
          {uploading ? (
            <div className="text-center space-y-3">
              <Loading text={retryCount > 0 ? `Retrying upload... (${retryCount}/3)` : "Uploading file..."} />
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
          ) : hasFile ? (
            // Show current file
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <Icon 
                  type={getFileIcon(getFileType(filename || ''))} 
                  className="h-8 w-8 text-primary-500" 
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {filename || 'Unknown file'}
                </p>
                <p className="text-xs text-gray-500 uppercase">
                  {getFileType(filename || '')}
                </p>
              </div>
            </div>
          ) : (
            // Show upload prompt
            placeholder || (
              <div className="text-center">
                <Icon type="upload" className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm font-medium text-gray-600">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {acceptedTypes.length <= 5 
                    ? acceptedTypes.map(type => type.replace('.', '').toUpperCase()).join(', ')
                    : 'PDF, DOC, PPT, Excel, Images, Archives'
                  }
                </p>
                {maxSize && (
                  <p className="text-xs text-gray-400 mt-1">
                    Max size: {maxSize}MB
                  </p>
                )}
              </div>
            )
          )}
        </div>

        {/* Action Buttons */}
        {hasFile && !uploading && (
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('file-upload-input')?.click()}
            >
              <Icon type="upload" className="w-4 h-4 mr-1" />
              Replace
            </Button>
            {showRemove && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemove}
              >
                <Icon type="trash" className="w-4 h-4 mr-1" />
                Remove
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Help Text */}
      {helpText && (
        <p className="text-xs text-gray-500">
          {helpText}
        </p>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
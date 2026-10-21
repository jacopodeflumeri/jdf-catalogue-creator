/**
 * SFTP Browser Component
 * Client component for navigating SFTP directories and selecting files
 */

'use client';

import { useState, useTransition, useEffect } from 'react';
import { listSFTPDirectory } from '../lib/actions';
import { formatFileSize, formatTimestamp } from '../lib/utils';
import type { SFTPDirectoryListing, SFTPItem, FileActionCallback } from '../types';
import SFTPFileUpload from './SFTPFileUpload';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Loading from '@/components/ui/Loading';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/providers/ToastProvider';

interface SFTPBrowserProps {
  /** Initial directory to display */
  initialPath?: string;
  /** Initial listing data (from server) */
  initialListing?: SFTPDirectoryListing;
  /** Callback when a file is selected */
  onFileSelect?: FileActionCallback;
  /** Callback when a directory is selected (for upload) */
  onDirectorySelect?: (path: string) => void;
  /** Callback when path changes (for tracking current location) */
  onPathChange?: (path: string) => void;
  /** Callback when directory loads successfully */
  onLoadSuccess?: () => void;
  /** Callback when directory load fails */
  onLoadError?: (error: Error) => void;
  /** Custom action button label */
  actionLabel?: string;
  /** Show only directories (for upload destination) */
  directoriesOnly?: boolean;
  /** Hide upload button */
  hideUpload?: boolean;
  /** Path of currently selected file */
  selectedFilePath?: string;
  /** Custom class name */
  className?: string;
}

export default function SFTPBrowser({
  initialPath = '/',
  initialListing,
  onFileSelect,
  onDirectorySelect,
  onPathChange,
  onLoadSuccess,
  onLoadError,
  actionLabel = 'Select',
  directoriesOnly = false,
  hideUpload = false,
  selectedFilePath,
  className = '',
}: SFTPBrowserProps) {
  const [listing, setListing] = useState<SFTPDirectoryListing | null>(
    initialListing || null
  );
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { addToast } = useToast();

  const currentPath = listing?.currentPath || initialPath;

  /**
   * Navigate to a directory
   */
  const navigateToDirectory = (path: string) => {
    startTransition(async () => {
      const result = await listSFTPDirectory(path);

      if (!result.success || !result.data) {
        const err = new Error(result.error || result.message);
        addToast({
          type: 'error',
          message: `Failed to load directory: ${err.message}`,
        });
        onLoadError?.(err);
        return;
      }

      setListing(result.data);
      onPathChange?.(result.data.currentPath);
      onLoadSuccess?.();
    });
  };

  /**
   * Handle file or directory click
   */
  const handleItemClick = (item: SFTPItem) => {
    if (item.type === 'directory') {
      navigateToDirectory(item.path);
    } else if (!directoriesOnly && onFileSelect) {
      onFileSelect(item);
    }
  };

  /**
   * Handle action button click
   */
  const handleActionClick = async (item: SFTPItem) => {
    if (item.type === 'directory' && onDirectorySelect) {
      onDirectorySelect(item.path);
    } else if (item.type === 'file' && onFileSelect) {
      setDownloadingFile(item.path);
      try {
        await onFileSelect(item);
      } finally {
        setDownloadingFile(null);
      }
    }
  };

  /**
   * Navigate to parent directory
   */
  const navigateToParent = () => {
    if (listing?.parentPath) {
      navigateToDirectory(listing.parentPath);
    }
  };

  /**
   * Handle successful upload
   */
  const handleUploadSuccess = () => {
    addToast({
      type: 'success',
      message: 'File uploaded successfully',
    });
    setShowUploadModal(false);
    // Refresh current directory
    navigateToDirectory(currentPath);
  };

  /**
   * Generate breadcrumb items
   */
  const breadcrumbs = currentPath
    .split('/')
    .filter(Boolean)
    .reduce(
      (acc, segment, index, array) => {
        const path = '/' + array.slice(0, index + 1).join('/');
        acc.push({ label: segment, path });
        return acc;
      },
      // '/' is this app's SFTP area, not the remote filesystem root.
      [{ label: 'Home', path: '/' }] as Array<{ label: string; path: string }>
    );

  // Initial load - use useEffect to avoid calling startTransition during render
  useEffect(() => {
    if (!listing && !isPending) {
      navigateToDirectory(initialPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className={`sftp-browser ${className}`}>
      {/* Breadcrumb Navigation */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <Icon type="folder" className="text-gray-500" />
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.path} className="flex items-center gap-2">
            {index > 0 && (
              <Icon type="chevron-right" size="sm" className="text-gray-400" />
            )}
            <button
              onClick={() => navigateToDirectory(crumb.path)}
              disabled={isPending || crumb.path === currentPath}
              className={`text-sm font-medium transition-colors ${
                crumb.path === currentPath
                  ? 'text-gray-900'
                  : 'text-primary-600 hover:text-primary-700'
              }`}
            >
              {crumb.label}
            </button>
          </div>
        ))}
      </div>

      {/* Parent Directory Button */}
      {listing?.parentPath && (
        <div className="mb-3 flex justify-between items-center">
          <Button
            onClick={navigateToParent}
            disabled={isPending}
            variant="ghost"
            size="sm"
          >
            <Icon type="arrow-left" size="sm" className='mr-2' />
            Back to Parent Directory
          </Button>
          {!hideUpload && (
            <Button
              onClick={() => setShowUploadModal(true)}
              variant="primary"
              size="sm"
            >
              <Icon type="upload" size="sm" className='mr-2' />
              Upload to Current Folder
            </Button>
          )}
        </div>
      )}

      {/* Loading State */}
      {isPending && (
        <div className="py-12">
          <Loading text="Loading directory..." />
        </div>
      )}

      {/* Directory Listing */}
      {!isPending && listing && (
        <>
          {listing.items.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <Icon type="folder" size="xl" className="mx-auto mb-2" />
              <p>This directory is empty</p>
            </div>
          ) : (
            <div className="space-y-1">
              {listing.items.map((item) => {
                const isDirectory = item.type === 'directory';
                const showItem = !directoriesOnly || isDirectory;
                const isSelected = selectedFilePath && item.path === selectedFilePath;

                if (!showItem) return null;

                return (
                  <div
                    key={item.path}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200'
                    } ${
                      isDirectory || onFileSelect
                        ? 'hover:bg-gray-50 cursor-pointer'
                        : ''
                    }`}
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Icon
                        type={isDirectory ? 'folder' : 'file'}
                        className={
                          isSelected
                            ? 'text-primary-600'
                            : isDirectory 
                              ? 'text-primary-600' 
                              : 'text-gray-500'
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate ${
                          isSelected ? 'text-primary-900' : 'text-gray-900'
                        }`}>
                          {item.name}
                        </div>
                        <div className={`text-xs flex items-center gap-3 ${
                          isSelected ? 'text-primary-700' : 'text-gray-500'
                        }`}>
                          {!isDirectory && <span>{formatFileSize(item.size)}</span>}
                          {item.modifyTime && (
                            <span>{formatTimestamp(item.modifyTime)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Button or Selected Badge */}
                    {isSelected ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-100 rounded-md">
                        <Icon type="check" size="sm" className="text-primary-600" />
                        <span className="text-sm font-medium text-primary-700">Selected</span>
                      </div>
                    ) : ((isDirectory && onDirectorySelect) ||
                      (!isDirectory && onFileSelect)) && (
                      <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <Button
                          onClick={() => handleActionClick(item)}
                          size="sm"
                          variant="secondary"
                          loading={downloadingFile === item.path}
                          disabled={downloadingFile === item.path}
                        >
                          {downloadingFile === item.path
                            ? 'Downloading...'
                            : actionLabel}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Upload File
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Upload to: <span className="font-mono font-medium">{currentPath}</span>
                </p>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Icon type="x" size="lg" />
              </button>
            </div>
            <div className="p-6">
              <SFTPFileUpload
                targetPath={currentPath}
                onUploadSuccess={handleUploadSuccess}
                config={{
                  allowCustomFilename: true,
                  maxFileSize: 100 * 1024 * 1024, // 100MB
                }}
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

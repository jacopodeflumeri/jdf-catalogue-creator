/**
 * SFTP File Upload Component
 * Client component for uploading files to SFTP with custom filename option
 */

'use client';

import { useState, useTransition, useRef } from 'react';
import { uploadSFTPFile } from '../lib/actions';
import type { UploadConfig } from '../types';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import FormInput from '@/components/ui/form/FormInput';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/providers/ToastProvider';

interface SFTPFileUploadProps {
    /** Target directory path */
    targetPath: string;
    /** Upload configuration */
    config?: UploadConfig;
    /** Callback on successful upload */
    onUploadSuccess?: (path: string, filename: string) => void;
    /** Custom class name */
    className?: string;
    fullCard?: boolean;
}

export default function SFTPFileUpload({
    targetPath,
    config = {},
    onUploadSuccess,
    className = '',
    fullCard = false,
}: SFTPFileUploadProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [customFilename, setCustomFilename] = useState('');
    const [isPending, startTransition] = useTransition();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addToast } = useToast();

    const {
        allowCustomFilename = true,
        filenamePrefix = '',
        allowedExtensions,
        maxFileSize,
    } = config;

    /**
     * Handle file selection
     */
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file extension
        if (allowedExtensions && allowedExtensions.length > 0) {
            const ext = '.' + file.name.split('.').pop()?.toLowerCase();
            if (!allowedExtensions.includes(ext)) {
                addToast({
                    type: 'error',
                    message: `Invalid file type. Allowed: ${allowedExtensions.join(', ')}`,
                });
                return;
            }
        }

        // Validate file size
        if (maxFileSize && file.size > maxFileSize) {
            const maxSizeMB = (maxFileSize / (1024 * 1024)).toFixed(2);
            addToast({
                type: 'error',
                message: `File too large. Maximum size: ${maxSizeMB}MB`,
            });
            return;
        }

        setSelectedFile(file);
        // Set default custom filename with prefix
        const baseFilename = filenamePrefix + file.name;
        setCustomFilename(baseFilename);
    };

    /**
     * Handle file upload
     */
    const handleUpload = () => {
        if (!selectedFile) return;

        startTransition(async () => {
            try {
                // Read file as base64
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const base64Data = e.target?.result as string;
                    // Remove data URL prefix
                    const base64Content = base64Data.split(',')[1];

                    const finalFilename = allowCustomFilename && customFilename
                        ? customFilename
                        : selectedFile.name;

                    const result = await uploadSFTPFile({
                        directory: targetPath,
                        filename: finalFilename,
                        fileDataBase64: base64Content,
                    });

                    if (result.success) {
                        addToast({
                            type: 'success',
                            message: result.message,
                        });

                        // Reset form
                        setSelectedFile(null);
                        setCustomFilename('');
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                        }

                        // Call success callback
                        if (onUploadSuccess && result.data) {
                            onUploadSuccess(result.data.path, result.data.filename);
                        }
                    } else {
                        addToast({
                            type: 'error',
                            message: result.error || result.message,
                        });
                    }
                };

                reader.onerror = () => {
                    addToast({
                        type: 'error',
                        message: 'Failed to read file',
                    });
                };

                reader.readAsDataURL(selectedFile);
            } catch (error) {
                addToast({
                    type: 'error',
                    message: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
            }
        });
    };

    /**
     * Clear selection
     */
    const handleClear = () => {
        setSelectedFile(null);
        setCustomFilename('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const uploadInput = (
        <>


            {/* File Input */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select File
                </label>
                <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    disabled={isPending}
                    accept={allowedExtensions?.join(',')}
                    className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                {allowedExtensions && allowedExtensions.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                        Allowed types: {allowedExtensions.join(', ')}
                    </p>
                )}
                {maxFileSize && (
                    <p className="mt-1 text-xs text-gray-500">
                        Max size: {(maxFileSize / (1024 * 1024)).toFixed(2)}MB
                    </p>
                )}
            </div>

            {/* Selected File Info */}
            {selectedFile && (
                <div className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Icon type="file" className="text-primary-600" />
                            <div>
                                <div className="text-sm font-medium text-gray-900">
                                    {selectedFile.name}
                                </div>
                                <div className="text-xs text-gray-600">
                                    {(selectedFile.size / 1024).toFixed(2)} KB
                                </div>
                            </div>
                        </div>
                        <Button
                            onClick={handleClear}
                            disabled={isPending}
                            variant="ghost"
                            size="sm"
                        >
                            <Icon type="x" size="sm" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Custom Filename Input */}
            {selectedFile && allowCustomFilename && (
                <div className="mb-4">
                    <FormInput
                        label="Custom Filename (optional)"
                        type="text"
                        value={customFilename}
                        onChange={(e) => setCustomFilename(e.target.value)}
                        placeholder={selectedFile.name}
                        disabled={isPending}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Leave blank to use original filename
                    </p>
                </div>
            )}

            {/* Upload Button */}
            <div className="flex gap-2">
                <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || isPending}
                    loading={isPending}
                    className="flex-1"
                >
                    <Icon type="upload" size="sm" />
                    {isPending ? 'Uploading...' : 'Upload File'}
                </Button>
                {selectedFile && (
                    <Button
                        onClick={handleClear}
                        disabled={isPending}
                        variant="secondary"
                    >
                        Cancel
                    </Button>
                )}
            </div>
        </>
    );

    if(!fullCard){
        return uploadInput;
    }


    return (
        <Card className={`sftp-file-upload ${className}`}>
            <h3 className="text-lg font-semibold mb-4">Upload File</h3>

            {/* Target Path Display */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Upload to:</div>
                <div className="font-mono text-sm text-gray-900 flex items-center gap-2">
                    <Icon type="folder" size="sm" className="text-primary-600" />
                    {targetPath}
                </div>
            </div>

            {uploadInput}

        </Card>
    );
}

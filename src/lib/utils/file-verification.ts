/**
 * File Content Verification Utility
 * Verifies that file content matches declared MIME type using magic bytes/file signatures
 */

export interface FileSignature {
  mimeType: string;
  extensions: string[];
  signatures: Uint8Array[];
  description: string;
}

// File signatures (magic bytes) for common file types
export const FILE_SIGNATURES: FileSignature[] = [
  // Images
  {
    mimeType: 'image/jpeg',
    extensions: ['jpg', 'jpeg'],
    signatures: [
      new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]), // JPEG JFIF
      new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1]), // JPEG EXIF
      new Uint8Array([0xFF, 0xD8, 0xFF, 0xE2]), // JPEG ICC
      new Uint8Array([0xFF, 0xD8, 0xFF, 0xE3]), // JPEG
      new Uint8Array([0xFF, 0xD8, 0xFF, 0xE8]), // JPEG SPIFF
    ],
    description: 'JPEG Image'
  },
  {
    mimeType: 'image/png',
    extensions: ['png'],
    signatures: [new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
    description: 'PNG Image'
  },
  {
    mimeType: 'image/gif',
    extensions: ['gif'],
    signatures: [
      new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), // GIF87a
      new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])  // GIF89a
    ],
    description: 'GIF Image'
  },
  {
    mimeType: 'image/webp',
    extensions: ['webp'],
    signatures: [new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])],
    description: 'WebP Image'
  },
  {
    mimeType: 'image/svg+xml',
    extensions: ['svg'],
    signatures: [
      new Uint8Array([0x3C, 0x3F, 0x78, 0x6D, 0x6C]), // <?xml
      new Uint8Array([0x3C, 0x73, 0x76, 0x67])        // <svg
    ],
    description: 'SVG Image'
  },

  // Documents
  {
    mimeType: 'application/pdf',
    extensions: ['pdf'],
    signatures: [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D])], // %PDF-
    description: 'PDF Document'
  },
  {
    mimeType: 'application/msword',
    extensions: ['doc'],
    signatures: [new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])], // OLE2
    description: 'Microsoft Word Document'
  },
  {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['docx'],
    signatures: [new Uint8Array([0x50, 0x4B, 0x03, 0x04])], // ZIP (DOCX is ZIP-based)
    description: 'Microsoft Word Document (DOCX)'
  },
  {
    mimeType: 'application/vnd.ms-powerpoint',
    extensions: ['ppt'],
    signatures: [new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])], // OLE2
    description: 'Microsoft PowerPoint'
  },
  {
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extensions: ['pptx'],
    signatures: [new Uint8Array([0x50, 0x4B, 0x03, 0x04])], // ZIP (PPTX is ZIP-based)
    description: 'Microsoft PowerPoint (PPTX)'
  },

  // Archives
  {
    mimeType: 'application/zip',
    extensions: ['zip'],
    signatures: [
      new Uint8Array([0x50, 0x4B, 0x03, 0x04]), // Standard ZIP
      new Uint8Array([0x50, 0x4B, 0x05, 0x06]), // Empty ZIP
      new Uint8Array([0x50, 0x4B, 0x07, 0x08])  // Spanned ZIP
    ],
    description: 'ZIP Archive'
  },
  {
    mimeType: 'application/x-rar-compressed',
    extensions: ['rar'],
    signatures: [
      new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00]), // RAR 1.5+
      new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x01])  // RAR 5.0+
    ],
    description: 'RAR Archive'
  },

  // Media
  {
    mimeType: 'video/mp4',
    extensions: ['mp4'],
    signatures: [
      new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]), // ftyp at offset 4
      new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70])  // ftyp at offset 4
    ],
    description: 'MP4 Video'
  },
  {
    mimeType: 'audio/mpeg',
    extensions: ['mp3'],
    signatures: [
      new Uint8Array([0xFF, 0xFB]), // MPEG-1 Layer 3
      new Uint8Array([0xFF, 0xF3]), // MPEG-1 Layer 3
      new Uint8Array([0xFF, 0xF2]), // MPEG-1 Layer 3
      new Uint8Array([0x49, 0x44, 0x33]) // ID3 tag
    ],
    description: 'MP3 Audio'
  }
];

/**
 * Check if buffer starts with any of the given signatures
 */
function matchesSignature(buffer: Uint8Array, signatures: Uint8Array[]): boolean {
  return signatures.some(signature => {
    if (buffer.length < signature.length) return false;
    
    for (let i = 0; i < signature.length; i++) {
      // Skip wildcards (0x00 in signature means any byte)
      if (signature[i] !== 0x00 && buffer[i] !== signature[i]) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Verify file content matches declared MIME type
 */
export async function verifyFileContent(file: File): Promise<{
  isValid: boolean;
  declaredType: string;
  detectedType?: string;
  error?: string;
}> {
  try {
    // Read first 32 bytes for signature detection
    const buffer = await file.slice(0, 32).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    const declaredType = file.type;
    
    // Find matching signatures
    const matchingSignatures = FILE_SIGNATURES.filter(sig => 
      matchesSignature(bytes, sig.signatures)
    );
    
    if (matchingSignatures.length === 0) {
      // Check if it's a text-based file (JSON, CSV, etc.)
      const textTypes = ['application/json', 'text/csv', 'text/plain'];
      if (textTypes.includes(declaredType)) {
        // For text files, try to decode as UTF-8
        try {
          const _text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(0, 16));
          return { isValid: true, declaredType };
        } catch {
          return { 
            isValid: false, 
            declaredType, 
            error: 'File appears to be binary but declared as text format' 
          };
        }
      }
      
      return { 
        isValid: false, 
        declaredType, 
        error: 'Unable to verify file content - unknown file signature' 
      };
    }
    
    // Check if declared type matches detected type
    const matchesDeclaredType = matchingSignatures.some(sig => sig.mimeType === declaredType);
    
    if (!matchesDeclaredType) {
      const detectedType = matchingSignatures[0].mimeType;
      return {
        isValid: false,
        declaredType,
        detectedType,
        error: `File content does not match declared type. Declared: ${declaredType}, Detected: ${detectedType}`
      };
    }
    
    return { 
      isValid: true, 
      declaredType,
      detectedType: matchingSignatures[0].mimeType 
    };
    
  } catch (error) {
    return { 
      isValid: false, 
      declaredType: file.type,
      error: `Failed to verify file content: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Check if file extension matches MIME type
 */
export function verifyFileExtension(filename: string, mimeType: string): boolean {
  const extension = getFileExtension(filename);
  const signature = FILE_SIGNATURES.find(sig => sig.mimeType === mimeType);
  return signature ? signature.extensions.includes(extension) : false;
}

/**
 * Comprehensive file verification (content + extension + size)
 */
export async function comprehensiveFileVerification(file: File, maxSizeBytes?: number): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Size check
  if (maxSizeBytes && file.size > maxSizeBytes) {
    errors.push(`File size ${file.size} bytes exceeds maximum ${maxSizeBytes} bytes`);
  }
  
  // Extension check
  if (!verifyFileExtension(file.name, file.type)) {
    warnings.push(`File extension '${getFileExtension(file.name)}' may not match MIME type '${file.type}'`);
  }
  
  // Content verification
  const contentVerification = await verifyFileContent(file);
  if (!contentVerification.isValid) {
    errors.push(contentVerification.error || 'File content verification failed');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
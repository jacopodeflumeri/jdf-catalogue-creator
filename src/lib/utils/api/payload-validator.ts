/**
 * Payload Validator and 401 Error Analyzer
 * Analyzes payloads and request structures to identify JSON compilation issues
 * that might cause 401 errors
 */

import logger from '@/lib/utils/logger';

interface PayloadAnalysis {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
  payload: any;
  serializedPayload?: string;
  payloadSize: number;
}

interface RequestAnalysis {
  url: string;
  method: string;
  headers: Record<string, string>;
  payload: any;
  payloadAnalysis: PayloadAnalysis;
  possibleCauses: string[];
}

/**
 * Analyzes a payload for common JSON serialization issues
 */
export function analyzePayload(payload: any): PayloadAnalysis {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let serializedPayload: string | undefined;
  let payloadSize = 0;

  try {
    // Attempt to serialize the payload
    serializedPayload = JSON.stringify(payload);
    payloadSize = new Blob([serializedPayload]).size;

    // Check for circular references
    try {
      JSON.parse(serializedPayload);
    } catch (_error) {
      issues.push('Payload contains circular references or non-serializable data');
      suggestions.push('Remove circular references and ensure all values are JSON-serializable');
    }

    // Check for undefined values
    if (serializedPayload.includes('null') && JSON.stringify(payload).includes('undefined')) {
      issues.push('Payload contains undefined values that became null in JSON');
      suggestions.push('Replace undefined values with null or remove them entirely');
    }

    // Check for functions in payload
    if (typeof payload === 'object' && payload !== null) {
      const hasFunctions = Object.values(payload).some(value => typeof value === 'function');
      if (hasFunctions) {
        issues.push('Payload contains function values that will be omitted in JSON');
        suggestions.push('Remove function values from payload before sending');
      }
    }

    // Check for Date objects that might not serialize correctly
    if (serializedPayload.includes('T') && serializedPayload.includes('Z')) {
      const datePattern = /"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g;
      if (datePattern.test(serializedPayload)) {
        suggestions.push('Consider converting Date objects to ISO strings or timestamps for consistency');
      }
    }

    // Check for very large payloads
    if (payloadSize > 1000000) { // 1MB
      issues.push(`Payload is very large (${Math.round(payloadSize / 1024)}KB)`);
      suggestions.push('Consider splitting large payloads or using pagination');
    }

    // Check for nested JSON strings (double encoding)
    if (typeof payload === 'object' && payload !== null) {
      Object.entries(payload).forEach(([key, value]) => {
        if (typeof value === 'string') {
          try {
            JSON.parse(value);
            issues.push(`Field "${key}" contains a JSON string that may cause double encoding`);
            suggestions.push(`Parse the JSON in field "${key}" before including in payload`);
          } catch {
            // Not a JSON string, which is fine
          }
        }
      });
    }

    // Check for special characters in string values
    if (typeof payload === 'object' && payload !== null) {
      Object.entries(payload).forEach(([key, value]) => {
        if (typeof value === 'string') {
          // Check for control characters
          if (/[\x00-\x1F\x7F]/.test(value)) {
            issues.push(`Field "${key}" contains control characters that may cause issues`);
            suggestions.push(`Clean control characters from field "${key}"`);
          }
          
          // Check for very long strings
          if (value.length > 10000) {
            issues.push(`Field "${key}" is very long (${value.length} characters)`);
            suggestions.push(`Consider truncating or splitting the value in field "${key}"`);
          }
        }
      });
    }

    // Check for array structure issues
    if (Array.isArray(payload)) {
      const hasInconsistentTypes = payload.some((item, index) => {
        if (index === 0) return false;
        return typeof item !== typeof payload[0];
      });
      
      if (hasInconsistentTypes) {
        issues.push('Array contains inconsistent data types');
        suggestions.push('Ensure all array items have consistent structure');
      }
    }

  } catch (error: any) {
    issues.push(`Failed to serialize payload: ${error.message}`);
    suggestions.push('Check for circular references, functions, or other non-serializable data');
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions,
    payload,
    serializedPayload,
    payloadSize
  };
}

/**
 * Analyzes a failed request to identify potential causes of 401 errors
 */
export function analyze401Error(
  url: string,
  method: string,
  headers: Record<string, string>,
  payload: any,
  responseData?: any
): RequestAnalysis {
  const payloadAnalysis = analyzePayload(payload);
  const possibleCauses: string[] = [];

  // Check Authorization header
  if (!headers.Authorization) {
    possibleCauses.push('Missing Authorization header');
  } else if (!headers.Authorization.startsWith('Bearer ')) {
    possibleCauses.push('Authorization header does not use Bearer token format');
  } else {
    const token = headers.Authorization.replace('Bearer ', '');
    if (token.length < 10) {
      possibleCauses.push('Authorization token appears to be too short');
    }
    if (!token || token === 'undefined' || token === 'null') {
      possibleCauses.push('Authorization token is empty or invalid');
    }
  }

  // Check Content-Type for JSON requests
  if (method !== 'GET' && payload && !headers['Content-Type']?.includes('application/json')) {
    possibleCauses.push('Missing or incorrect Content-Type header for JSON payload');
  }

  // Check for payload issues that might cause authentication problems
  if (payloadAnalysis.issues.length > 0) {
    possibleCauses.push('Payload serialization issues detected (see payload analysis)');
  }

  // Check response data for clues
  if (responseData) {
    if (typeof responseData === 'string') {
      if (responseData.toLowerCase().includes('malformed') || responseData.toLowerCase().includes('invalid json')) {
        possibleCauses.push('Server reported malformed or invalid JSON in request');
      }
      if (responseData.toLowerCase().includes('token')) {
        possibleCauses.push('Server response mentions token issues');
      }
    }
  }

  return {
    url,
    method,
    headers,
    payload,
    payloadAnalysis,
    possibleCauses
  };
}

/**
 * Logs a detailed 401 error analysis to console
 */
export function log401Analysis(analysis: RequestAnalysis): void {
  logger.group('🔍 401 Error Analysis');
  
  logger.log('📋 Request Details:', {
    method: analysis.method,
    url: analysis.url,
    payloadSize: analysis.payloadAnalysis.payloadSize
  });

  if (analysis.possibleCauses.length > 0) {
    logger.warn('⚠️ Possible Causes:');
    analysis.possibleCauses.forEach((cause, index) => {
      logger.warn(`  ${index + 1}. ${cause}`);
    });
  }

  if (analysis.payloadAnalysis.issues.length > 0) {
    logger.error('🐛 Payload Issues:');
    analysis.payloadAnalysis.issues.forEach((issue, index) => {
      logger.error(`  ${index + 1}. ${issue}`);
    });
  }

  if (analysis.payloadAnalysis.suggestions.length > 0) {
    logger.info('💡 Suggestions:');
    analysis.payloadAnalysis.suggestions.forEach((suggestion, index) => {
      logger.info(`  ${index + 1}. ${suggestion}`);
    });
  }

  if (analysis.payloadAnalysis.serializedPayload) {
    logger.log('📦 Serialized Payload Preview:', 
      analysis.payloadAnalysis.serializedPayload.length > 500 
        ? analysis.payloadAnalysis.serializedPayload.substring(0, 500) + '...'
        : analysis.payloadAnalysis.serializedPayload
    );
  }

  logger.log('🔧 Headers:', analysis.headers);
  
  logger.groupEnd();
}

/**
 * Validates a payload before sending to ensure it won't cause 401 errors
 */
export function validatePayloadBeforeSend(payload: any): { isValid: boolean; errors: string[] } {
  const analysis = analyzePayload(payload);
  
  const criticalErrors = analysis.issues.filter(issue => 
    issue.includes('circular') || 
    issue.includes('serialize') || 
    issue.includes('control characters') ||
    issue.includes('double encoding')
  );

  return {
    isValid: criticalErrors.length === 0,
    errors: criticalErrors
  };
}


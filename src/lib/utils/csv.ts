/**
 * CSV utility functions for proper escaping and formatting
 */

/**
 * Escapes a value for CSV format according to RFC 4180
 * - Wraps values containing commas, quotes, or newlines in double quotes
 * - Escapes existing double quotes by doubling them
 * 
 * @param value - The value to escape
 * @returns Properly escaped CSV value
 */
export function escapeCsvValue(value: string): string {
  if (!value) return '';
  
  const stringValue = String(value).trim();
  // Spreadsheet applications can interpret these prefixes as formulas even
  // when the value is correctly quoted as CSV. Prefixing with an apostrophe is
  // the portable neutralization recommended for human-opened exports.
  const safeValue = /^[=+\-@]/.test(stringValue) ? `'${stringValue}` : stringValue;
  
  // Check if value needs escaping (contains comma, quote, or newline)
  const needsEscaping = /[",\n\r]/.test(safeValue);
  
  if (needsEscaping) {
    // Escape existing double quotes by doubling them
    const escaped = safeValue.replace(/"/g, '""');
    // Wrap in double quotes
    return `"${escaped}"`;
  }
  
  return safeValue;
}

/**
 * Creates a CSV row from an array of values
 * Each value is properly escaped according to RFC 4180
 * 
 * @param values - Array of values to join into a CSV row
 * @returns Properly formatted CSV row
 */
export function createCsvRow(values: string[]): string {
  return values.map(escapeCsvValue).join(',');
}

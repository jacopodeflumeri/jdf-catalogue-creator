/**
 * Activity Log Types
 * 
 * Types for logging user and system activities
 */

export interface ActivityLogResponse extends Record<string, unknown> {
  id: number;
  created_at: string;
  user_id: number;
  account_id: number;
  type: string;
  details: string;
  message: string;
  linked_id?: number;
}
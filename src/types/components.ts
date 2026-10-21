/**
 * UI Component Props Types
 *
 * Type definitions for reusable UI components
 */

import React from "react";

// Base component props
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

// Button component
export interface ButtonProps extends BaseComponentProps {
  variant?:
    | "primary"
    | "primaryDisabled"
    | "secondary"
    | "danger"
    | "ghost"
    | "outline"
    | "simple"
    | "colorful"
    | "circle"
    | "override"
    | "overrideNoBorder"
    | "menuInactive"
    | "menuActive"
    | "none";
  size?: "xxs" | "xs" | "xsm" | "xsmd" | "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  title?: string;
}

// Toast notification
export interface ToastProps {
  id?: string;
  message: string;
  type?: "success" | "error" | "warning" | "info";
  duration?: number;
  onClose?: () => void;
  show: boolean;
}

// Card component
export interface CardProps extends BaseComponentProps {
  title?: string;
  description?: string;
  footer?: React.ReactNode;
  hoverable?: boolean;
  noPadding?: boolean;
  noPaddingContent?: boolean;
  canOverflow?: boolean;
  noBg?: boolean;
  onClick?: () => void;
  isClickable?: boolean;
  headerActions?: React.ReactNode;
}

// Table component
export interface TableColumn<T> {
  key: keyof T;
  title: string;
  render?: (value: unknown, record: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: "left" | "right" | "center";
}

export interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    onPageChange?: (page: number) => void;
  };
  onRowClick?: (record: T) => void;
  className?: string;
  sortable?: boolean;
  defaultSortKey?: keyof T;
  defaultSortOrder?: "asc" | "desc";
  onSort?: (key: keyof T, order: "asc" | "desc") => void;
  emptyState?: {
    icon?: React.ReactNode;
    title?: string;
    description?: string;
    action?: React.ReactNode;
  };
}

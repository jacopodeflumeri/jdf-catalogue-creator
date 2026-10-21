'use client';

import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Loading from '@/components/ui/Loading';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'full';
  loading?: boolean;
  children: React.ReactNode;
  useShadowRoot?: boolean;
  noPadding ?: boolean;
  noScroll?: boolean;
  footer?: React.ReactNode;
}
 
export default function Modal({
  isOpen,
  onClose,
  title,
  size = 'lg',
  loading = false,
  children,
  useShadowRoot = false,
  noPadding = false,
  noScroll = false,
  footer
}: ModalProps) {
  const shadowHostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const [isMounted, setIsMounted] = React.useState(false);

  // Ensure we only render on the client side
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    xxl: 'max-w-[1800px]',
    full: 'max-w-full'
  };

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle Shadow DOM creation and content injection
  useEffect(() => {
    if (!useShadowRoot || !shadowHostRef.current || !isOpen) return;

    // Always recreate the shadow root to ensure clean state
    if (shadowRootRef.current) {
      // If shadow root exists, we need to recreate the host element
      const parent = shadowHostRef.current.parentNode;
      const newHost = document.createElement('div');
      newHost.className = shadowHostRef.current.className;
      newHost.style.cssText = shadowHostRef.current.style.cssText;
      
      if (parent) {
        parent.replaceChild(newHost, shadowHostRef.current);
        shadowHostRef.current = newHost;
      }
    }

    // Create new shadow root
    shadowRootRef.current = shadowHostRef.current.attachShadow({ mode: 'open' });
    const shadowRoot = shadowRootRef.current;

    // Create basic styles for the shadow root content
    const shadowStyles = `
      <style>
        :host {
          all: initial;
          display: block;
          position: relative;
          width: 100%;
          height: 100%;
          overflow: auto;
          background: white;
          font-family: system-ui, -apple-system, sans-serif;
          line-height: 1.5;
          color: #333333;
        }
        
        * {
          box-sizing: border-box;
        }
        
      </style>
    `;

    // Handle different types of children content
    let contentHTML = '';
    if (typeof children === 'string') {
      contentHTML = children;
    } else if (React.isValidElement(children)) {
      // For React elements, we'll need to render them to string (simplified approach)
      contentHTML = '<div>React content not supported in Shadow DOM</div>';
    } else {
      contentHTML = String(children || '');
    }

    // Create the content container
    const fullContent = `
      ${shadowStyles}
      <div class="shadow-content">
        ${contentHTML}
      </div>
    `;

    // Set the shadow root content
    shadowRoot.innerHTML = fullContent;

  }, [useShadowRoot, isOpen, children]);

  // Don't render until mounted on client side
  if (!isMounted || !isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-[rgba(26,26,26,0.16)] backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={`glass-modal rounded-3xl ${sizeClasses[size]} w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-white/65 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#1a1a1a]">
            {title}
          </h3>
          <Button
            onClick={onClose}
            variant="override"
            size="sm"
            className="p-1.5 text-[#1a1a1a]/52 hover:text-[#1a1a1a] hover:bg-white/60 border-0 rounded-lg transition-colors duration-300"
            title="Close"
          >
            <Icon type="x" size="sm" />
          </Button>
        </div>

        {/* Content */}
        <div className={`flex-1 ${noScroll ? 'overflow-hidden flex' : 'overflow-auto'} relative min-h-0`}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loading size="md" />
            </div>
          ) : useShadowRoot ? (
            <div 
              ref={shadowHostRef}
              className="w-full h-full min-h-[400px] relative"
              style={{ 
                transform: 'translateZ(0)', // Creates a new stacking context
                contain: 'layout style paint' // Provides containment for fixed elements
              }}
            />
          ) : (
            <div
              className={`w-full ${noScroll ? 'flex flex-col' : 'h-full'} relative ${noPadding ? '' : 'p-8'}`}
              style={{ 
              transform: 'translateZ(0)', // Creates a new stacking context
              contain: 'layout style paint' // Provides containment for fixed elements
              }}
            >
              {children}
            </div>
          )}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-8 py-6 border-t border-white/65 bg-white/18 rounded-b-3xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  // Render modal as portal to document.body to avoid stacking context issues
  return createPortal(modalContent, document.body);
}

'use client';

import React from 'react';
import Loading from '@/components/ui/Loading';

interface LoadingModalProps {
  isVisible: boolean;
  title?: string;
  description?: string;
}

export default function LoadingModal({ 
  isVisible, 
  title = "Processing Data", 
  description = "Please wait while we process your request..." 
}: LoadingModalProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-[rgba(26,26,26,0.16)] backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-modal rounded-3xl p-8">
        <div className="flex flex-col items-center space-y-3">
          <Loading text="" size="sm" />
          <div className="text-[#1a1a1a] font-medium">{title}</div>
          <div className="text-sm text-[#1a1a1a]/60">{description}</div>
        </div>
      </div>
    </div>
  );
}

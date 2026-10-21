'use client';

import { ReactNode, useState } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
  contentClassName?: string;
  buttonClassName?: string;
  variant?: 'underline' | 'button';
}

export default function Tabs({
  tabs,
  defaultTab,
  className = '',
  contentClassName = '',
  buttonClassName = '',
  variant = 'underline',
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  const getTabButtonClasses = (isActive: boolean) => {
    if (variant === 'button') {
      return [
        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-full transition-all duration-300',
        isActive
          ? 'prism-button text-white'
          : 'frost-button text-[#1a1a1a]/70 hover:text-[#1a1a1a]',
      ].join(' ');
    }

    return [
      'flex items-center gap-2 px-4 py-3 text-sm rounded-xl font-medium transition-all duration-300 border',
      isActive
        ? 'bg-[rgba(255,255,255,0.52)] border-white/80 text-primary shadow-[0_2px_10px_rgba(141,119,247,0.1)]'
        : 'bg-transparent border-transparent text-[#1a1a1a]/60 hover:bg-white/30 hover:border-white/60 hover:text-[#1a1a1a]',
    ].join(' ');
  };

  return (
    <div className={`flex flex-col ${className}`}>
      <div
        className={`flex flex-wrap gap-2 ${variant === 'button' ? 'p-5 pt-0' : 'p-2'} bg-white/26 border border-white/55 rounded-2xl ${buttonClassName}`}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={getTabButtonClasses(activeTab === tab.id)}
            type="button"
          >
            {tab.icon && <span className="text-base">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>

      <div className={`flex-1 overflow-y-auto ${contentClassName}`}>
        {activeTabContent}
      </div>
    </div>
  );
}

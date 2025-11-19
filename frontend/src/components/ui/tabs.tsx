import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tab = {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
};

type TabsProps = {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  tabClassName?: string;
  activeTabClassName?: string;
};

export function Tabs({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  tabClassName = '',
  activeTabClassName = '',
}: TabsProps) {
  const activeTabData = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  return (
    <div className={className}>
      {/* Barre d'onglets */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Navigation">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm',
                activeTab === tab.id
                  ? `border-blue-500 text-blue-600 ${activeTabClassName}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                tabClassName
              )}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.icon && <span className="mr-2">{tab.icon}</span>}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu de l'onglet actif */}
      <div className="mt-6">
        {activeTabData.content}
      </div>
    </div>
  );
}

// Composant de panneau d'onglet
Tabs.Panel = function TabPanel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('py-4', className)}>{children}</div>;
};

// Composant de conteneur d'onglet
Tabs.Container = function TabContainer({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('bg-white rounded-lg shadow', className)}>{children}</div>;
};

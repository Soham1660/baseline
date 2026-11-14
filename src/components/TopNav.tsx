import React from 'react';
import type { ApartmentRecord, AppScreen } from '../types/baseline';

interface TopNavProps {
  activeScreen: AppScreen;
  activeApartment: ApartmentRecord | null;
  onNavigate: (screen: AppScreen) => void;
  onOpenNewApartment: () => void;
  onReturnHome: () => void;
}

const WORKSPACE_TABS: Array<{ id: AppScreen; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'move-in', label: 'Move-In' },
  { id: 'move-out', label: 'Move-Out' },
  { id: 'compare', label: 'Compare' },
  { id: 'claims', label: 'Claims' },
];

export const TopNav: React.FC<TopNavProps> = ({
  activeScreen,
  activeApartment,
  onNavigate,
  onOpenNewApartment,
  onReturnHome,
}) => {
  const showWorkspaceNav = activeApartment !== null && activeScreen !== 'landing';

  return (
    <header className="no-print sticky top-0 z-30 border-b border-[#DFDED8] bg-[#F8F7F3]/95 backdrop-blur-xs">
      <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between gap-8 px-4 sm:px-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={onReturnHome}
          className="cursor-pointer font-sans text-sm font-semibold tracking-[0.18em] text-[#20211F] uppercase whitespace-nowrap shrink-0 hover:opacity-80 transition-opacity"
        >
          BASELINE
        </button>

        {/* Zone 2: Concise Single-Line Navigation */}
        {showWorkspaceNav ? (
          <nav
            aria-label="Inspection workflow"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {WORKSPACE_TABS.map((tab) => {
              const isActive =
                activeScreen === tab.id ||
                (tab.id === 'claims' && activeScreen === 'reconsideration');
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onNavigate(tab.id)}
                  className={`relative py-4 text-sm whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-[#20211F] font-semibold'
                      : 'text-[#62635F] hover:text-[#20211F]'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-[2px] bg-[#20211F]"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        ) : (
          <nav
            aria-label="Overview sections"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-[#62635F]"
          >
            <a
              href="#workflow"
              className="hover:text-[#20211F] transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#records"
              className="hover:text-[#20211F] transition-colors whitespace-nowrap shrink-0"
            >
              Saved Records
            </a>
            <a
              href="#integrity"
              className="hover:text-[#20211F] transition-colors whitespace-nowrap shrink-0"
            >
              Integrity &amp; Privacy
            </a>
          </nav>
        )}

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          {showWorkspaceNav ? (
            <button
              type="button"
              onClick={() => onNavigate('report')}
              className={`cursor-pointer rounded-lg px-4 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                activeScreen === 'report'
                  ? 'bg-[#C9473D] text-white'
                  : 'bg-[#20211F] text-white hover:bg-[#353734]'
              }`}
            >
              Export Report
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenNewApartment}
              className="cursor-pointer rounded-lg bg-[#20211F] px-4 py-2 text-xs font-medium text-white hover:bg-[#353734] transition-colors whitespace-nowrap shrink-0"
            >
              New Apartment
            </button>
          )}
        </div>
      </div>

      {/* Mobile secondary compact tab row (stays within compact height budget) */}
      {showWorkspaceNav && (
        <nav
          aria-label="Mobile inspection workflow"
          className="flex md:hidden items-center gap-1 overflow-x-auto border-t border-[#DFDED8] bg-[#F8F7F3] px-3 py-1.5"
        >
          {WORKSPACE_TABS.map((tab) => {
            const isActive =
              activeScreen === tab.id ||
              (tab.id === 'claims' && activeScreen === 'reconsideration');
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onNavigate(tab.id)}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? 'bg-[#20211F] text-white'
                    : 'text-[#62635F] hover:text-[#20211F]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
};

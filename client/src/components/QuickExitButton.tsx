import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuickExitButtonProps {
  className?: string;
  /** Render as a floating button that tracks the mouse Y position */
  floating?: boolean;
}

export function QuickExitButton({ className = '', floating = false }: QuickExitButtonProps) {
  const { t } = useTranslation();

  const handleExit = () => {
    // Clear sensitive storage before leaving
    try {
      sessionStorage.removeItem('roc_search_state');
      localStorage.removeItem('roc_selected_locations');
      localStorage.removeItem('roc_favorites');
      localStorage.removeItem('roc_service_votes');
      // Intentionally keep i18nextLng (language preference, not sensitive)
    } catch {
      // Storage access may be blocked in some contexts
    }

    // Note: history.pushState cannot replace entries with cross-origin URLs
    // due to browser security restrictions, so we skip history flooding.
    window.location.replace('https://www.google.com');
  };

  if (floating) {
    return <FloatingExitButton onExit={handleExit} label={t('quickExit')} />;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`gap-2 h-9 px-3 ${className}`}
      onClick={handleExit}
      data-testid="button-quick-exit"
    >
      <X className="w-4 h-4 flex-shrink-0" />
      <span className="hidden sm:inline text-sm font-medium">
        {t('quickExit')}
      </span>
    </Button>
  );
}

/** Floating version fixed to the bottom-right corner */
function FloatingExitButton({ onExit, label }: { onExit: () => void; label: string }) {
  return (
    <button
      onClick={onExit}
      style={{
        position: 'fixed',
        right: '16px',
        bottom: '24px',
        zIndex: 50,
      }}
      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm shadow-lg shadow-red-600/30 hover:shadow-xl hover:shadow-red-600/40 transition-all focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
      aria-label={label || "Quick exit - leave this site immediately"}
      data-testid="button-quick-exit-floating"
    >
      <X className="w-4 h-4" aria-hidden="true" />
      <span className="hidden sm:inline">{label || "Exit"}</span>
    </button>
  );
}

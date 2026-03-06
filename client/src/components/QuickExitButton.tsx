import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuickExitButtonProps {
  className?: string;
}

export function QuickExitButton({ className = '' }: QuickExitButtonProps) {
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

    try {
      const depth = window.history.length;
      for (let i = 0; i < depth; i++) {
        window.history.pushState(null, '', 'https://www.google.com');
      }
    } catch {
      // pushState may fail in rare edge cases — still navigate away
    }
    window.location.replace('https://www.google.com');
  };

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

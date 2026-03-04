import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuickExitButtonProps {
  className?: string;
}

export function QuickExitButton({ className = '' }: QuickExitButtonProps) {
  const { t } = useTranslation();

  const handleExit = () => {
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

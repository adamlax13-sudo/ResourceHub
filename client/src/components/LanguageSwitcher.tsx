import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { languages } from '@/lib/i18n';

interface LanguageSwitcherProps {
  variant?: 'default' | 'ghost';
  className?: string;
}

export function LanguageSwitcher({ variant = 'ghost', className = '' }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const currentLanguage = languages.find(l => l.code === i18n.language) || languages[0];

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size="sm"
          className={`gap-2 h-9 px-3 ${className}`}
          data-testid="button-language-switcher"
        >
          <Globe className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline text-sm font-medium">
            {currentLanguage.nativeName}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto w-64">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`cursor-pointer ${
              i18n.language === lang.code ? 'bg-accent' : ''
            }`}
            data-testid={`language-option-${lang.code}`}
          >
            <span className="mr-2 font-medium">{lang.nativeName}</span>
            <span className="text-muted-foreground text-sm">({lang.name})</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

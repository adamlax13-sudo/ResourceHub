import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Sparkles, ArrowRight } from "lucide-react";
import rocLogo from "@/assets/About_Recovery_on_Campus_Alberta_1768060674341.png";

export function WelcomeModal() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(false);

  useEffect(() => {
    if (authLoading || profileLoading || sessionDismissed) return;
    
    if (user && profile && !profile.profileCompleted) {
      setOpen(true);
    }
  }, [user, profile, authLoading, profileLoading, sessionDismissed]);

  const handleContinue = () => {
    setOpen(false);
    setLocation("/profile");
  };

  const handleSkip = () => {
    setOpen(false);
    setSessionDismissed(true);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleSkip();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4">
            <a href="https://www.recoveryoncampusalberta.ca/" target="_blank" rel="noopener noreferrer">
              <img src={rocLogo} alt="ROC Logo" className="h-16 w-auto mx-auto hover:opacity-80 transition-opacity" />
            </a>
          </div>
          <DialogTitle className="text-2xl font-display">
            {t('profile.welcomeTitle')}
          </DialogTitle>
          <DialogDescription className="text-base">
            {t('profile.welcomeDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
            <User className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">{t('profile.demographicsTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('profile.demographicsDesc')}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
            <Sparkles className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">{t('nav2.recommended')}</p>
              <p className="text-sm text-muted-foreground">{t('recommended.emptyDesc')}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={handleSkip}
            className="flex-1"
            data-testid="button-skip-welcome"
          >
            {t('profile.skipButton')}
          </Button>
          <Button 
            onClick={handleContinue}
            className="flex-1"
            data-testid="button-continue-welcome"
          >
            {t('profile.continueButton')}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

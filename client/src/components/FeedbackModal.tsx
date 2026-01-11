import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Send, CheckCircle } from "lucide-react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: async (data: { name?: string; email?: string; message: string }) => {
      return apiRequest("POST", "/api/feedback", data);
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: t('feedback.successTitle'),
        description: t('feedback.successMessage'),
      });
    },
    onError: () => {
      toast({
        title: t('feedback.errorTitle'),
        description: t('feedback.errorMessage'),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    mutation.mutate({
      name: name.trim() || undefined,
      email: email.trim() || undefined,
      message: message.trim(),
    });
  };

  const handleClose = () => {
    setName("");
    setEmail("");
    setMessage("");
    setSubmitted(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="feedback-modal">
        <DialogHeader>
          <DialogTitle data-testid="feedback-title">{t('feedback.title')}</DialogTitle>
          <DialogDescription>{t('feedback.description')}</DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t('feedback.thankYou')}</h3>
            <p className="text-muted-foreground text-sm">{t('feedback.thankYouMessage')}</p>
            <Button onClick={handleClose} className="mt-6" data-testid="button-close-feedback">
              {t('feedback.close')}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feedback-name">{t('feedback.name')}</Label>
              <Input
                id="feedback-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('feedback.namePlaceholder')}
                data-testid="input-feedback-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-email">{t('feedback.email')}</Label>
              <Input
                id="feedback-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('feedback.emailPlaceholder')}
                data-testid="input-feedback-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-message">{t('feedback.message')} *</Label>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('feedback.messagePlaceholder')}
                rows={4}
                required
                data-testid="input-feedback-message"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={handleClose} data-testid="button-cancel-feedback">
                {t('feedback.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!message.trim() || mutation.isPending}
                data-testid="button-submit-feedback"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('feedback.sending')}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    {t('feedback.submit')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

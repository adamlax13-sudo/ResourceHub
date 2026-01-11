import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, MessageSquare } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FEEDBACK_TYPES = [
  { value: "suggestion", label: "Suggestion" },
  { value: "bug", label: "Bug Report" },
  { value: "general", label: "General Feedback" },
  { value: "other", label: "Other" },
];

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [feedbackType, setFeedbackType] = useState("");
  const [message, setMessage] = useState("");

  const submitFeedback = useMutation({
    mutationFn: async (data: { name?: string; email?: string; feedbackType: string; message: string }) => {
      return apiRequest("/api/feedback", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: t('feedback.success'),
        description: t('feedback.successDesc'),
      });
      setName("");
      setEmail("");
      setFeedbackType("");
      setMessage("");
      onClose();
    },
    onError: () => {
      toast({
        title: t('feedback.error'),
        description: t('feedback.errorDesc'),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackType || !message.trim()) return;
    
    submitFeedback.mutate({
      name: name.trim() || undefined,
      email: email.trim() || undefined,
      feedbackType,
      message: message.trim(),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            {t('feedback.title')}
          </DialogTitle>
          <DialogDescription>
            {t('feedback.description')}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="feedback-name">{t('feedback.name')}</Label>
              <Input
                id="feedback-name"
                placeholder={t('feedback.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-feedback-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-email">{t('feedback.email')}</Label>
              <Input
                id="feedback-email"
                type="email"
                placeholder={t('feedback.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-feedback-email"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="feedback-type">{t('feedback.type')}</Label>
            <Select value={feedbackType} onValueChange={setFeedbackType}>
              <SelectTrigger data-testid="select-feedback-type">
                <SelectValue placeholder={t('feedback.typePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="feedback-message">{t('feedback.message')}</Label>
            <Textarea
              id="feedback-message"
              placeholder={t('feedback.messagePlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              required
              data-testid="textarea-feedback-message"
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-feedback-cancel">
              {t('feedback.cancel')}
            </Button>
            <Button 
              type="submit" 
              disabled={!feedbackType || !message.trim() || submitFeedback.isPending}
              data-testid="button-feedback-submit"
            >
              {submitFeedback.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {t('feedback.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

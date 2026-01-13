import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { type ServiceDetail } from "@shared/routes";
import { ProcessTimeline } from "./ProcessTimeline";
import { FileText, Clock, Phone, MapPin, ExternalLink, CheckCircle, Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useAddFavorite, useFavorites } from "@/hooks/use-favorites";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useLocation } from "wouter";

interface ServiceModalProps {
  service: ServiceDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

function linkifyText(text: string): React.ReactNode {
  if (!text) return text;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  
  // Match: full URLs, emails, phone numbers, and domain names (like recoverycollegecalgary.ca)
  const combinedRegex = /(https?:\/\/[^\s,]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})|([a-zA-Z0-9][-a-zA-Z0-9]*\.(?:ca|com|org|net|edu|gov)(?:\/[^\s,]*)?)/gi;
  
  let match;
  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    const matched = match[0];
    if (match[1]) {
      parts.push(
        <a key={key++} href={matched} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
          {matched}
        </a>
      );
    } else if (match[2]) {
      parts.push(
        <a key={key++} href={`mailto:${matched}`} className="text-primary hover:underline">
          {matched}
        </a>
      );
    } else if (match[3]) {
      const cleanPhone = matched.replace(/[^\d+]/g, '');
      parts.push(
        <a key={key++} href={`tel:${cleanPhone}`} className="text-primary hover:underline">
          {matched}
        </a>
      );
    } else if (match[4]) {
      const url = matched.startsWith('http') ? matched : `https://${matched}`;
      parts.push(
        <a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
          {matched}
        </a>
      );
    }
    
    lastIndex = match.index + matched.length;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
}

export function ServiceModal({ service, isOpen, onClose }: ServiceModalProps) {
  const { user } = useAuth();
  const { data: favorites } = useFavorites();
  const addFavorite = useAddFavorite();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  if (!service) return null;

  const isFavorited = favorites?.some(f => f.serviceId === service.id);

  const handleFavorite = () => {
    if (!user) {
      toast({
        title: t('auth.signInRequired'),
        description: t('auth.signInToSave'),
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 2000);
      return;
    }

    addFavorite.mutate({
      serviceId: service.id,
      serviceName: service.name,
      category: service.category,
      serviceDetails: service,
    }, {
      onSuccess: () => {
        toast({
          title: t('toast.saved'),
          description: t('toast.resourceAdded'),
          action: (
            <ToastAction 
              altText={t('toast.viewResources')} 
              onClick={() => {
                onClose();
                setLocation('/my-resources');
              }}
              data-testid="toast-action-view-resources"
            >
              {t('toast.viewResources')}
            </ToastAction>
          ),
        });
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] md:w-full h-[85vh] md:h-[90vh] max-h-[85vh] md:max-h-[90vh] p-0 overflow-hidden bg-background border-0 shadow-2xl rounded-xl md:rounded-3xl">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header - compact on mobile */}
          <div className="bg-card px-4 py-3 md:px-8 md:py-6 border-b border-border flex-shrink-0">
            <div className="flex flex-col gap-2 pr-8 md:pr-10">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <Badge className="w-fit max-w-[60%] md:max-w-none bg-primary/10 text-primary hover:bg-primary/20 pointer-events-none whitespace-normal text-left">
                  {service.category}
                </Badge>
                {!isFavorited && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFavorite}
                    disabled={addFavorite.isPending}
                    className="gap-2 shrink-0"
                    aria-label={`Save ${service.name} to my resources`}
                    data-testid="button-save-resource"
                  >
                    {addFavorite.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Heart className="w-4 h-4" aria-hidden="true" />
                    )}
                    <span className="hidden sm:inline">{t('service.save')}</span>
                  </Button>
                )}
                {isFavorited && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 shrink-0" aria-label="Service saved">
                    <CheckCircle className="w-3 h-3 mr-1" aria-hidden="true" />
                    <span className="hidden sm:inline">{t('service.saved')}</span>
                    <span className="sm:hidden">Saved</span>
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-lg sm:text-xl md:text-2xl font-display font-bold text-foreground break-words">
                {service.name}
              </DialogTitle>
              <DialogDescription className="text-sm md:text-base text-muted-foreground mt-1 line-clamp-3 md:line-clamp-none">
                {service.description}
              </DialogDescription>
            </div>
          </div>

          <ScrollArea className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 140px)' }}>
            <div className="p-4 md:p-8 grid md:grid-cols-12 gap-6 md:gap-8">
              
              {/* Left Column: Process & Requirements */}
              <div className="md:col-span-7 space-y-8">
                
                {/* Process Section */}
                <section>
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-foreground">
                    <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">1</span>
                    {t('service.accessProcess')}
                  </h3>
                  <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
                    <ProcessTimeline steps={service.process} />
                  </div>
                </section>

                {/* Required Documents Section */}
                <section>
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-foreground">
                    <span className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">2</span>
                    {t('service.requiredDocs')}
                  </h3>
                  <div className="grid gap-3">
                    {service.requiredDocs.map((doc, idx) => (
                      <div key={idx} className="flex items-start gap-3 bg-card p-4 rounded-xl shadow-sm border border-border min-w-0">
                        <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground font-medium break-words min-w-0">{doc}</span>
                      </div>
                    ))}
                    {service.requiredDocs.length === 0 && (
                      <div className="text-sm text-muted-foreground italic p-4 bg-card rounded-xl border border-border">
                        {t('service.noDocsListed')}
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Right Column: Key Info Card - sticky on desktop */}
              <div className="md:col-span-5">
                <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden md:sticky md:top-0 z-10">
                  <h3 className="font-bold text-lg border-b border-border px-6 py-4">{t('service.keyInfo')}</h3>

                  <div className="p-6 pt-4 space-y-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{t('service.waitTime')}</div>
                        <div className="font-medium text-foreground mt-0.5 break-words">{linkifyText(service.waitTimes)}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{t('service.eligibility')}</div>
                        <div className="font-medium text-foreground mt-0.5 break-words">{linkifyText(service.eligibility)}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-orange-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{t('service.location')}</div>
                        <div className="font-medium text-foreground mt-0.5 break-words">{linkifyText(service.location)}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Phone className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{t('service.contact')}</div>
                        <div className="font-medium text-foreground mt-0.5 break-all">{linkifyText(service.contact)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-border">
                    <Button 
                      className="w-full bg-primary hover:bg-primary/90 text-white font-semibold h-12 rounded-xl shadow-lg shadow-primary/20"
                      aria-label={`Contact ${service.name}`}
                      data-testid="button-contact-provider"
                    >
                      {t('service.contactProvider')}
                      <ExternalLink className="ml-2 w-4 h-4" aria-hidden="true" />
                    </Button>
                    <p className="text-center text-xs text-muted-foreground mt-3">
                      {t('service.externalLink')}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

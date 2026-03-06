import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { type ServiceDetail } from "@shared/routes";
import { type FavoriteCandidate } from "@/hooks/use-favorites";
import { ProcessTimeline } from "./ProcessTimeline";
import { FileText, Clock, Phone, MapPin, ExternalLink, CheckCircle, Globe, Mail, Loader2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { isSafeUrl, linkifyText } from "@/lib/linkify";

interface ServiceModalProps {
  serviceId: string | null;
  isOpen: boolean;
  onClose: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (service: FavoriteCandidate) => void;
}

// ============= CONTACT PARSING =============

interface ParsedContact {
  phones: string[];
  websites: string[];
  emails: string[];
  other: string;
}

function parseContactInfo(contact: string): ParsedContact {
  if (!contact) return { phones: [], websites: [], emails: [], other: '' };

  const phones: string[] = [];
  const websites: string[] = [];
  const emails: string[] = [];

  let remaining = contact;

  // Extract full URLs (https://...)
  const urlRegex = /https?:\/\/[^\s,;|]+/gi;
  remaining = remaining.replace(urlRegex, (match) => {
    const cleaned = match.replace(/[.)]+$/, '');
    if (isSafeUrl(cleaned)) websites.push(cleaned);
    return ' ';
  });

  // Extract bare domains (example.ca, example.com/path)
  const domainRegex = /\b([a-zA-Z0-9][-a-zA-Z0-9]*\.(?:ca|com|org|net|edu|gov)(?:\/[^\s,;|]*)?)\b/gi;
  remaining = remaining.replace(domainRegex, (match) => {
    const url = `https://${match}`;
    if (isSafeUrl(url)) websites.push(match);
    return ' ';
  });

  // Extract email addresses
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  remaining = remaining.replace(emailRegex, (match) => {
    emails.push(match);
    return ' ';
  });

  // Extract phone numbers (with optional parenthetical label like "(HELP)")
  const phoneRegex = /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})(\s*\([^)]*\))?/g;
  remaining = remaining.replace(phoneRegex, (fullMatch, phone, label) => {
    phones.push((phone + (label || '')).trim());
    return ' ';
  });

  // Also match short crisis/service numbers like "988", "211"
  const shortPhoneRegex = /\b(988|211|911)\b/g;
  remaining = remaining.replace(shortPhoneRegex, (match) => {
    if (!phones.some(p => p.includes(match))) phones.push(match);
    return ' ';
  });

  // Clean up remaining text: strip common labels, separators, extra whitespace
  const other = remaining
    .replace(/\b(phone|tel|telephone|fax|website|web|url|email|e-mail|address|contact)\s*:?\s*/gi, '')
    .replace(/[,;|]+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^[,\s]+|[,\s]+$/g, '');

  return { phones, websites, emails, other };
}

// Build the href for the main CTA button: prefer website, fall back to first phone
function getServiceUrl(parsed: ParsedContact): string | null {
  if (parsed.websites.length > 0) {
    const site = parsed.websites[0];
    return site.startsWith('http') ? site : `https://${site}`;
  }
  if (parsed.phones.length > 0) {
    const digits = parsed.phones[0].replace(/[^\d+]/g, '');
    return `tel:${digits}`;
  }
  return null;
}

// ============= LOADING SKELETON =============

function ServiceModalSkeleton() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-card px-4 py-3 md:px-8 md:py-6 border-b border-border flex-shrink-0">
        <div className="flex flex-col gap-2 pr-8 md:pr-10">
          <div className="h-5 w-24 bg-muted animate-pulse rounded" />
          <div className="h-7 w-3/4 bg-muted animate-pulse rounded" />
          <div className="h-4 w-full bg-muted animate-pulse rounded mt-1" />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm">{t('service.loading')}</p>
        </div>
      </div>
    </div>
  );
}

// ============= COMPONENT =============

export function ServiceModal({ serviceId, isOpen, onClose, isFavorite = false, onToggleFavorite }: ServiceModalProps) {
  const { t } = useTranslation();
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch service details when modal opens
  useEffect(() => {
    if (!serviceId || !isOpen) {
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetch(`/api/services/${encodeURIComponent(serviceId)}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Service not found' : 'Failed to load service');
        }
        return res.json();
      })
      .then(data => {
        setService({
          ...data,
          process: Array.isArray(data.process) ? data.process : [],
          requiredDocs: Array.isArray(data.requiredDocs) ? data.requiredDocs : [],
        });
        setIsLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [serviceId, isOpen]);

  // Clear service data when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Small delay to allow close animation
      const timeout = setTimeout(() => {
        setService(null);
        setError(null);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  if (!serviceId) return null;

  // Show loading or error states
  if (isLoading || error || !service) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl w-[95vw] md:w-full h-[85vh] md:h-[90vh] max-h-[85vh] md:max-h-[90vh] p-0 overflow-hidden bg-background border-0 shadow-2xl rounded-xl md:rounded-3xl">
          {error ? (
            <div className="flex flex-col h-full items-center justify-center gap-3">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" onClick={onClose}>{t('common.close')}</Button>
            </div>
          ) : (
            <ServiceModalSkeleton />
          )}
        </DialogContent>
      </Dialog>
    );
  }

  const parsed = parseContactInfo(service.contact);

  // Add websiteUrl from the dedicated field if available and not already in parsed
  if (service.websiteUrl && service.websiteUrl.trim()) {
    const url = service.websiteUrl.trim();
    // Only add if not already present in parsed websites
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const alreadyExists = parsed.websites.some(w => {
      const normalizedExisting = w.startsWith('http') ? w : `https://${w}`;
      return normalizedExisting.toLowerCase() === normalizedUrl.toLowerCase();
    });
    if (!alreadyExists && isSafeUrl(normalizedUrl)) {
      parsed.websites.unshift(url); // Add at beginning as primary website
    }
  }

  // Add phone from dedicated field if available and not already in parsed
  if (service.phone && service.phone.trim()) {
    const phone = service.phone.trim();
    const alreadyExists = parsed.phones.some(p =>
      p.replace(/\D/g, '') === phone.replace(/\D/g, '')
    );
    if (!alreadyExists) {
      parsed.phones.unshift(phone); // Add at beginning as primary phone
    }
  }

  // Add email from dedicated field if available and not already in parsed
  if (service.email && service.email.trim()) {
    const email = service.email.trim().toLowerCase().replace(/[?&#].*/g, '');
    const alreadyExists = parsed.emails.some(e => e.toLowerCase() === email);
    if (!alreadyExists && email.includes('@')) {
      parsed.emails.unshift(email); // Add at beginning as primary email
    }
  }

  const serviceUrl = getServiceUrl(parsed);
  const hasWebsite = parsed.websites.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] md:w-full h-[85vh] md:h-[90vh] max-h-[85vh] md:max-h-[90vh] p-0 overflow-hidden bg-background border-0 shadow-2xl rounded-xl md:rounded-3xl">
        <div className="flex flex-col h-full overflow-hidden">
          <div className="bg-card px-4 py-3 md:px-8 md:py-6 border-b border-border flex-shrink-0 relative">
            <div className="flex flex-col gap-2 pr-16 md:pr-20">
              <Badge className="w-fit max-w-[80%] md:max-w-none bg-primary/10 text-primary hover:bg-primary/20 pointer-events-none whitespace-normal text-left">
                {service.category}
              </Badge>
              <DialogTitle className="text-lg sm:text-xl md:text-2xl font-display font-bold text-foreground break-words">
                {service.name}
              </DialogTitle>
              <DialogDescription className="text-sm md:text-base text-muted-foreground mt-1 line-clamp-5 md:line-clamp-none">
                {service.description}
              </DialogDescription>
            </div>
            {/* Heart / favorite button */}
            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(service)}
                className={`absolute top-3 right-10 md:top-6 md:right-14 p-2 rounded-full transition-colors ${
                  isFavorite
                    ? "text-red-500"
                    : "text-muted-foreground/40 hover:text-red-400"
                }`}
                aria-label={isFavorite ? "Remove from shortlist" : "Save to shortlist"}
                aria-pressed={isFavorite}
              >
                <Heart className={`w-5 h-5 ${isFavorite ? "fill-current" : ""}`} aria-hidden="true" />
              </button>
            )}
          </div>

          <ScrollArea className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 140px)' }}>
            <div className="p-4 md:p-8 grid md:grid-cols-12 gap-6 md:gap-8">

              <div className="md:col-span-7 space-y-8">

                <section>
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-foreground">
                    <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">1</span>
                    {t('service.accessProcess')}
                  </h3>
                  <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
                    <ProcessTimeline steps={service.process} />
                  </div>
                </section>

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
                        <div className="font-medium text-foreground mt-0.5 break-words">{linkifyText(service.waitTimes || "Contact service provider for wait time")}</div>
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
                        <div className="font-medium text-foreground mt-0.5 break-words">
                          {linkifyText(service.address?.trim() || service.location || '')}
                        </div>
                      </div>
                    </div>

                    {/* Phone numbers */}
                    {parsed.phones.length > 0 && (
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Phone className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{t('service.phone')}</div>
                          <div className="space-y-1 mt-0.5">
                            {parsed.phones.map((phone, idx) => {
                              const digits = phone.replace(/[^\d+]/g, '');
                              return (
                                <div key={idx}>
                                  <a href={`tel:${digits}`} className="font-medium text-primary hover:underline">
                                    {phone}
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Emails */}
                    {parsed.emails.length > 0 && (
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                          <Mail className="w-4 h-4 text-violet-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{t('service.email')}</div>
                          <div className="space-y-1 mt-0.5">
                            {parsed.emails.map((email, idx) => (
                              <div key={idx}>
                                <a href={`mailto:${email}`} className="font-medium text-primary hover:underline break-all">
                                  {email}
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}


                    {/* Fallback: if parsing yielded nothing, show the raw contact string */}
                    {parsed.phones.length === 0 && parsed.websites.length === 0 && parsed.emails.length === 0 && !parsed.other && (
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Phone className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{t('service.contact')}</div>
                          <div className="font-medium text-foreground mt-0.5 break-all">{linkifyText(service.contact)}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-6 py-4 border-t border-border">
                    {serviceUrl ? (
                      <a href={serviceUrl} target="_blank" rel="noopener noreferrer" className="block">
                        <Button
                          className="w-full bg-primary hover:bg-primary/90 text-white font-semibold h-12 rounded-xl shadow-lg shadow-primary/20"
                          aria-label={`Visit ${service.name} webpage`}
                          data-testid="button-visit-webpage"
                        >
                          {hasWebsite ? t('service.visitWebpage') : t('service.callProvider')}
                          <ExternalLink className="ml-2 w-4 h-4" aria-hidden="true" />
                        </Button>
                      </a>
                    ) : (
                      <Button
                        className="w-full bg-muted text-muted-foreground font-semibold h-12 rounded-xl cursor-default"
                        disabled
                      >
                        {t('service.noWebpage')}
                      </Button>
                    )}
                    {serviceUrl && (
                      <p className="text-center text-xs text-muted-foreground mt-3">
                        {t('service.externalLink')}
                      </p>
                    )}
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

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

type FeedbackType = "incorrect_info" | "service_closed" | "missing_service" | "bad_search" | "general";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  serviceId?: string;
  serviceName?: string;
  searchQuery?: string;
}

const FIELD_OPTIONS = ["Phone", "Address", "Hours", "Description", "Website", "Other"] as const;

export function FeedbackModal({ open, onClose, serviceId, serviceName, searchQuery }: FeedbackModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const isServiceContext = !!serviceId;

  // Determine available types based on context
  const availableTypes: FeedbackType[] = isServiceContext
    ? ["incorrect_info", "service_closed"]
    : searchQuery
      ? ["missing_service", "bad_search", "general"]
      : ["missing_service", "general"];

  const defaultType = isServiceContext ? "incorrect_info" : "general";

  // Form state
  const [selectedType, setSelectedType] = useState<FeedbackType>(defaultType);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Incorrect info: field checkboxes
  const [wrongFields, setWrongFields] = useState<Set<string>>(new Set());

  // Missing service: structured fields
  const [missingServiceName, setMissingServiceName] = useState("");
  const [missingServiceUrl, setMissingServiceUrl] = useState("");

  // Reset form when modal opens/closes or context changes
  useEffect(() => {
    if (open) {
      setSelectedType(defaultType);
      setMessage("");
      setName("");
      setEmail("");
      setHp("");
      setSubmitted(false);
      setWrongFields(new Set());
      setMissingServiceName("");
      setMissingServiceUrl("");
    }
  }, [open, defaultType]);

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/feedback", data);
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: t("feedback.successTitle"), description: t("feedback.successMessage") });
    },
    onError: () => {
      toast({ title: t("feedback.errorTitle"), description: t("feedback.errorMessage"), variant: "destructive" });
    },
  });

  function buildMessage(): string {
    const parts: string[] = [];

    if (selectedType === "incorrect_info" && wrongFields.size > 0) {
      parts.push(`Fields reported: ${Array.from(wrongFields).join(", ")}`);
    }

    if (selectedType === "missing_service") {
      parts.push(`Service: ${missingServiceName.trim()}`);
      parts.push(`Website: ${missingServiceUrl.trim() || "Not provided"}`);
    }

    if (selectedType === "service_closed" && !message.trim()) {
      parts.push("Flagged as no longer operating");
    }

    if (message.trim()) {
      if (parts.length > 0) parts.push("");
      parts.push(message.trim());
    }

    return parts.join("\n") || "Flagged as no longer operating";
  }

  function handleSubmit() {
    const builtMessage = buildMessage();
    if (!builtMessage.trim()) return;

    if (selectedType === "missing_service" && !missingServiceName.trim()) return;

    mutation.mutate({
      name: name.trim() || undefined,
      email: email.trim() || undefined,
      message: builtMessage,
      type: selectedType,
      serviceId: isServiceContext ? serviceId : undefined,
      serviceName: isServiceContext ? serviceName : undefined,
      searchQuery: selectedType === "bad_search" ? searchQuery : undefined,
      hp,
    });
  }

  const typeLabels: Record<FeedbackType, string> = {
    incorrect_info: t("feedback.typeIncorrectInfo"),
    service_closed: t("feedback.typeServiceClosed"),
    missing_service: t("feedback.typeMissingService"),
    bad_search: t("feedback.typeBadSearch"),
    general: t("feedback.typeGeneral"),
  };

  const placeholders: Record<FeedbackType, string> = {
    incorrect_info: t("feedback.placeholderIncorrectInfo"),
    service_closed: t("feedback.placeholderServiceClosed"),
    missing_service: t("feedback.placeholderMissingService"),
    bad_search: t("feedback.placeholderBadSearch"),
    general: t("feedback.placeholderGeneral"),
  };

  const fieldKeys: Record<string, string> = {
    Phone: t("feedback.fieldPhone"),
    Address: t("feedback.fieldAddress"),
    Hours: t("feedback.fieldHours"),
    Description: t("feedback.fieldDescription"),
    Website: t("feedback.fieldWebsite"),
    Other: t("feedback.fieldOther"),
  };

  const title = isServiceContext ? t("feedback.reportTitle") : t("feedback.title");
  const isMessageRequired = selectedType !== "service_closed" && selectedType !== "incorrect_info";
  const canSubmit = selectedType === "service_closed"
    || (selectedType === "incorrect_info" && (message.trim().length > 0 || wrongFields.size > 0))
    || (selectedType === "missing_service" && missingServiceName.trim().length > 0 && message.trim().length > 0)
    || (selectedType !== "service_closed" && selectedType !== "incorrect_info" && selectedType !== "missing_service" && message.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col" data-testid="feedback-modal">
        <DialogHeader>
          <DialogTitle>{submitted ? t("feedback.thankYou") : title}</DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center py-8 gap-4">
            <CheckCircle className="w-12 h-12 text-green-500" />
            <p className="text-center text-muted-foreground">{t("feedback.thankYouMessage")}</p>
            <Button variant="outline" onClick={onClose}>{t("feedback.close")}</Button>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-4 pr-1">
            {/* Honeypot */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
              <input type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
            </div>

            {/* Type selector */}
            <div>
              <Label className="text-sm font-medium">{t("feedback.typeLabel")}</Label>
              <RadioGroup
                value={selectedType}
                onValueChange={(v) => setSelectedType(v as FeedbackType)}
                className="mt-2 space-y-2"
                aria-label={t("feedback.typeLabel")}
                data-testid="feedback-type-selector"
              >
                {availableTypes.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <RadioGroupItem value={type} id={`feedback-type-${type}`} />
                    <Label htmlFor={`feedback-type-${type}`} className="font-normal cursor-pointer">
                      {typeLabels[type]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Header context hint */}
            {!isServiceContext && (
              <p className="text-xs text-muted-foreground" data-testid="feedback-header-hint">
                {t("feedback.headerHint")}
              </p>
            )}

            {/* Service name (read-only, for service context) */}
            {isServiceContext && serviceName && (
              <div>
                <Label htmlFor="feedback-service-name" className="text-sm">{t("feedback.serviceName")}</Label>
                <Input id="feedback-service-name" value={serviceName} disabled className="mt-1 bg-muted" />
              </div>
            )}

            {/* Search query (read-only, for bad_search) */}
            {selectedType === "bad_search" && searchQuery && (
              <div>
                <Label htmlFor="feedback-search-query" className="text-sm">{t("feedback.searchQuery")}</Label>
                <Input id="feedback-search-query" value={searchQuery} disabled className="mt-1 bg-muted" />
              </div>
            )}

            {/* Field checkboxes for incorrect_info */}
            {selectedType === "incorrect_info" && (
              <div>
                <Label className="text-sm">{t("feedback.fieldsWrongLabel")}</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {FIELD_OPTIONS.map((field) => (
                    <div key={field} className="flex items-center space-x-2">
                      <Checkbox
                        id={`field-${field}`}
                        checked={wrongFields.has(field)}
                        onCheckedChange={(checked) => {
                          const next = new Set(wrongFields);
                          checked ? next.add(field) : next.delete(field);
                          setWrongFields(next);
                        }}
                      />
                      <Label htmlFor={`field-${field}`} className="font-normal text-sm cursor-pointer">
                        {fieldKeys[field]}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing service structured fields */}
            {selectedType === "missing_service" && (
              <>
                <div>
                  <Label htmlFor="missing-service-name" className="text-sm">
                    {t("feedback.missingServiceName")} *
                  </Label>
                  <Input
                    id="missing-service-name"
                    value={missingServiceName}
                    onChange={(e) => setMissingServiceName(e.target.value)}
                    placeholder={t("feedback.missingServiceNamePlaceholder")}
                    className="mt-1"
                    maxLength={255}
                    data-testid="input-missing-service-name"
                  />
                </div>
                <div>
                  <Label htmlFor="missing-service-url" className="text-sm">
                    {t("feedback.missingServiceUrl")}
                  </Label>
                  <Input
                    id="missing-service-url"
                    type="url"
                    value={missingServiceUrl}
                    onChange={(e) => setMissingServiceUrl(e.target.value)}
                    placeholder={t("feedback.missingServiceUrlPlaceholder")}
                    className="mt-1"
                    maxLength={500}
                  />
                </div>
              </>
            )}

            {/* Message textarea */}
            <div>
              <Label htmlFor="feedback-message" className="text-sm">
                {t("feedback.message")} {isMessageRequired ? "*" : ""}
              </Label>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={placeholders[selectedType]}
                className="mt-1 min-h-[80px]"
                maxLength={2000}
                data-testid="input-feedback-message"
              />
            </div>

            {/* Optional name/email */}
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-3">{t("feedback.optional")}</p>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="feedback-name" className="text-sm">{t("feedback.name")}</Label>
                  <Input
                    id="feedback-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("feedback.namePlaceholder")}
                    className="mt-1"
                    maxLength={255}
                  />
                </div>
                <div>
                  <Label htmlFor="feedback-email" className="text-sm">{t("feedback.email")}</Label>
                  <Input
                    id="feedback-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("feedback.emailPlaceholder")}
                    className="mt-1"
                    maxLength={255}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="flex-1">
                {t("feedback.cancel")}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || mutation.isPending}
                className="flex-1"
                data-testid="button-submit-feedback"
              >
                {mutation.isPending ? t("feedback.sending") : t("feedback.submit")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

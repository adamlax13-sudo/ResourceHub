import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, ExternalLink, Trash2 } from "lucide-react";
import { useFavoritesContext } from "@/hooks/use-favorites";
import { useToast } from "@/hooks/use-toast";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import type { ServiceDetail } from "@shared/routes";

interface MyShortlistProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectService?: (id: string) => void;
}

interface PrintOptions {
  includeProcessSteps: boolean;
  includeRequiredDocs: boolean;
}

/** Build plain text for a single service (used for copy) */
function serviceToText(svc: ServiceDetail, options: PrintOptions): string {
  const lines: string[] = [svc.name, svc.category];
  if (svc.address) lines.push(svc.address);
  else if (svc.location) lines.push(svc.location);
  if (svc.phone) lines.push(`Phone: ${svc.phone}`);
  if (svc.email) lines.push(`Email: ${svc.email}`);
  if (svc.websiteUrl) lines.push(svc.websiteUrl);
  if (options.includeProcessSteps && svc.process.length > 0) {
    lines.push("", "How to Access:");
    svc.process.forEach((step, i) => lines.push(`  ${i + 1}. ${step}`));
  }
  if (options.includeRequiredDocs) {
    lines.push("", "What You'll Need:");
    if (svc.requiredDocs.length > 0) {
      svc.requiredDocs.forEach((d) => lines.push(`  - ${d}`));
    } else {
      lines.push("  No specific documents required.");
    }
  }
  return lines.join("\n");
}

function buildPrintPage(
  doc: Document,
  services: ServiceDetail[],
  options: PrintOptions,
): void {
  const style = doc.createElement("style");
  style.textContent = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 24px 40px;
      color: #1a1a1a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    .toolbar button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      background: #fff;
      color: #374151;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .toolbar button:hover { background: #f3f4f6; border-color: #9ca3af; }
    .toolbar button.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
    .toolbar button.primary:hover { background: #1d4ed8; }
    .header h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 2px; }
    .header .meta { font-size: 12px; color: #888; margin-bottom: 24px; }
    .service {
      position: relative;
      border: 1px solid #e2e2e2;
      border-radius: 8px;
      padding: 16px 18px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .service:hover { border-color: #c7c7c7; }
    .service-name { font-size: 16px; font-weight: 700; margin-bottom: 4px; line-height: 1.3; }
    .badge {
      display: inline-block;
      background: #f3f4f6;
      color: #4b5563;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 2px 8px;
      border-radius: 3px;
      border: 1px solid #e5e7eb;
      margin-bottom: 8px;
    }
    .contact-row { font-size: 12px; color: #444; line-height: 1.8; }
    .contact-row span { margin-right: 16px; }
    .section-divider {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6b7280;
      margin: 12px 0 6px;
      padding-top: 10px;
      border-top: 1px solid #eee;
    }
    .steps { padding-left: 20px; margin: 0; }
    .steps li { font-size: 12px; color: #333; line-height: 1.6; margin-bottom: 2px; }
    .docs { padding-left: 18px; margin: 0; list-style: disc; }
    .docs li { font-size: 12px; color: #333; line-height: 1.6; margin-bottom: 2px; }
    .copy-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 4px 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #fff;
      color: #6b7280;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s, background 0.15s;
    }
    .service:hover .copy-btn { opacity: 1; }
    .copy-btn:hover { background: #f3f4f6; color: #374151; }
    .footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      font-size: 11px;
      color: #888;
    }
    @media print {
      .toolbar, .copy-btn { display: none !important; }
      body { padding-top: 0; }
    }
  `;
  doc.head.appendChild(style);

  // Title
  const titleEl = doc.createElement("title");
  titleEl.textContent = "My Shortlist";
  doc.head.appendChild(titleEl);

  // Toolbar (hidden in print)
  const toolbar = doc.createElement("div");
  toolbar.className = "toolbar";

  const copyAllBtn = doc.createElement("button");
  copyAllBtn.className = "primary";
  copyAllBtn.textContent = "\u{1F4CB} Copy All";
  toolbar.appendChild(copyAllBtn);

  const printBtn = doc.createElement("button");
  printBtn.textContent = "\u{1F5B6} Save as PDF";
  printBtn.addEventListener("click", () => doc.defaultView?.print());
  toolbar.appendChild(printBtn);

  doc.body.appendChild(toolbar);

  // Header
  const header = doc.createElement("div");
  header.className = "header";

  const h1 = doc.createElement("h1");
  h1.textContent = "My Shortlist";
  header.appendChild(h1);

  const metaEl = doc.createElement("div");
  metaEl.className = "meta";
  const dateStr = new Date().toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  metaEl.textContent = `${dateStr} \u00B7 ${services.length} service${services.length !== 1 ? "s" : ""}`;
  header.appendChild(metaEl);

  doc.body.appendChild(header);

  // Helper to create a contact span
  function contactSpan(text: string): HTMLSpanElement {
    const span = doc.createElement("span");
    span.textContent = text;
    return span;
  }

  // Build text for all services (for copy-all)
  const allText = services
    .map((svc) => serviceToText(svc, options))
    .join("\n\n---\n\n");

  // Wire up copy-all button
  copyAllBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(allText).then(() => {
      copyAllBtn.textContent = "\u2705 Copied!";
      setTimeout(() => {
        copyAllBtn.textContent = "\u{1F4CB} Copy All";
      }, 1500);
    });
  });

  // Service cards
  for (const svc of services) {
    const card = doc.createElement("div");
    card.className = "service";

    // Per-service copy button
    const copyBtn = doc.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "Copy";
    const svcText = serviceToText(svc, options);
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(svcText).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
      });
    });
    card.appendChild(copyBtn);

    const nameEl = doc.createElement("div");
    nameEl.className = "service-name";
    nameEl.textContent = svc.name;
    card.appendChild(nameEl);

    const badge = doc.createElement("span");
    badge.className = "badge";
    badge.textContent = svc.category;
    card.appendChild(badge);

    // Contact row
    const contactRow = doc.createElement("div");
    contactRow.className = "contact-row";
    if (svc.address) contactRow.appendChild(contactSpan(`\u{1F4CD} ${svc.address}`));
    else if (svc.location) contactRow.appendChild(contactSpan(`\u{1F4CD} ${svc.location}`));
    if (svc.phone) contactRow.appendChild(contactSpan(`\u{1F4DE} ${svc.phone}`));
    if (svc.email) contactRow.appendChild(contactSpan(`\u2709 ${svc.email}`));
    if (svc.websiteUrl) contactRow.appendChild(contactSpan(`\u{1F310} ${svc.websiteUrl}`));
    if (contactRow.childNodes.length > 0) card.appendChild(contactRow);

    // Process steps (optional)
    if (options.includeProcessSteps && svc.process.length > 0) {
      const divider = doc.createElement("div");
      divider.className = "section-divider";
      divider.textContent = "How to Access";
      card.appendChild(divider);

      const ol = doc.createElement("ol");
      ol.className = "steps";
      for (const step of svc.process) {
        const li = doc.createElement("li");
        li.textContent = step;
        ol.appendChild(li);
      }
      card.appendChild(ol);
    }

    // Required docs (optional)
    if (options.includeRequiredDocs) {
      const divider = doc.createElement("div");
      divider.className = "section-divider";
      divider.textContent = "What You'll Need";
      card.appendChild(divider);

      if (svc.requiredDocs.length > 0) {
        const ul = doc.createElement("ul");
        ul.className = "docs";
        for (const d of svc.requiredDocs) {
          const li = doc.createElement("li");
          li.textContent = d;
          ul.appendChild(li);
        }
        card.appendChild(ul);
      } else {
        const noDocsMsg = doc.createElement("p");
        noDocsMsg.textContent = "No specific documents required.";
        noDocsMsg.style.cssText = "font-size: 12px; color: #666; font-style: italic; margin-top: 4px;";
        card.appendChild(noDocsMsg);
      }
    }

    doc.body.appendChild(card);
  }

  // Footer
  const footer = doc.createElement("div");
  footer.className = "footer";
  const dateFooter = doc.createElement("span");
  dateFooter.textContent = `Generated ${dateStr}`;
  footer.appendChild(dateFooter);
  doc.body.appendChild(footer);
}

export function MyShortlist({ isOpen, onClose, onSelectService }: MyShortlistProps) {
  const { favorites, favoriteCount, removeFavorite, clearFavorites } = useFavoritesContext();
  const { toast } = useToast();
  const panelRef = useFocusTrap(isOpen, onClose);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (confirmingClear) {
      confirmTimerRef.current = setTimeout(() => setConfirmingClear(false), 3000);
    }
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, [confirmingClear]);
  const [includeSteps, setIncludeSteps] = useState(true);
  const [includeDocs, setIncludeDocs] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      // Fetch full details for all favorites in parallel
      const details = await Promise.all(
        favorites.map(async (fav) => {
          const res = await fetch(`/api/services/${encodeURIComponent(fav.id)}`);
          if (!res.ok) return null;
          return res.json() as Promise<ServiceDetail>;
        }),
      );

      const services: ServiceDetail[] = details.filter(
        (d): d is ServiceDetail => d !== null,
      );

      if (services.length === 0) {
        toast({
          title: "Export failed",
          description: "Could not load service details. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast({
          title: "Popup blocked",
          description: "Please allow popups for this site to export your shortlist.",
          variant: "destructive",
        });
        return;
      }

      if (services.length < favorites.length) {
        toast({
          title: "Some services unavailable",
          description: `Exported ${services.length} of ${favorites.length} services.`,
        });
      }

      buildPrintPage(printWindow.document, services, {
        includeProcessSteps: includeSteps,
        includeRequiredDocs: includeDocs,
      });
      printWindow.document.close();
    } catch {
      toast({
        title: "Export failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }, [favorites, includeSteps, includeDocs, toast]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="shortlist-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="shortlist-panel"
            ref={panelRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 w-80 bg-card shadow-2xl z-50 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="My Shortlist"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500 fill-current" aria-hidden="true" />
                My Shortlist
                <span className="text-sm font-normal text-muted-foreground">
                  ({favoriteCount})
                </span>
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close shortlist panel"
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable service list */}
            <div className="overflow-y-auto flex-1 px-4 py-4">
              {favoriteCount === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
                  <Heart className="w-10 h-10 text-muted-foreground/30" aria-hidden="true" />
                  <p className="text-muted-foreground text-sm">No services saved yet.</p>
                  <p className="text-muted-foreground/60 text-xs">
                    Tap the heart icon on any service card to save it here.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3" aria-label="Saved services">
                  {favorites.map((fav) => (
                    <li
                      key={fav.id}
                      className="flex items-start gap-3 bg-background rounded-xl border border-border p-3"
                    >
                      <div
                        className={`flex-1 min-w-0${onSelectService ? " cursor-pointer" : ""}`}
                        onClick={() => onSelectService?.(fav.id)}
                        role={onSelectService ? "button" : undefined}
                        tabIndex={onSelectService ? 0 : undefined}
                        onKeyDown={(e) => {
                          if (onSelectService && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            onSelectService(fav.id);
                          }
                        }}
                      >
                        <p className={`text-sm font-semibold leading-snug break-words ${onSelectService ? "text-primary hover:underline" : "text-foreground"}`}>
                          {fav.name}
                        </p>
                        <p className="text-xs text-primary font-medium mt-0.5 uppercase tracking-wide">
                          {fav.category}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 break-words">
                          {fav.location}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFavorite(fav.id)}
                        aria-label={`Remove ${fav.name} from shortlist`}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer actions */}
            {favoriteCount > 0 && (
              <div className="px-4 py-4 border-t border-border shrink-0 space-y-2">
                {/* Export options */}
                <div className="space-y-1.5 mb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Export Options
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={includeSteps}
                      onChange={(e) => setIncludeSteps(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary/30 w-3.5 h-3.5"
                    />
                    <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                      Include access steps
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={includeDocs}
                      onChange={(e) => setIncludeDocs(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary/30 w-3.5 h-3.5"
                    />
                    <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                      Include required documents
                    </span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
                      </svg>
                      Loading...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                      View Shortlist
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmingClear) {
                      clearFavorites();
                      setConfirmingClear(false);
                    } else {
                      setConfirmingClear(true);
                    }
                  }}
                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    confirmingClear
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : "border-border bg-background text-muted-foreground hover:text-destructive hover:border-destructive/30"
                  }`}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  {confirmingClear ? "Tap again to confirm" : "Clear all"}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

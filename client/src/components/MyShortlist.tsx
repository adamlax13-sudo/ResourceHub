import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, FileText, Trash2 } from "lucide-react";
import { useFavoritesContext } from "@/hooks/use-favorites";
import { useToast } from "@/hooks/use-toast";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import type { ServiceDetail } from "@shared/routes";

interface MyShortlistProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PrintOptions {
  includeProcessSteps: boolean;
  includeRequiredDocs: boolean;
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
      padding: 0 24px 40px;
      color: #1a1a1a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-bar { background: #D6001C; height: 6px; margin: 0 -24px 24px; }
    .header h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 2px; }
    .header .subtitle { font-size: 13px; color: #555; margin-bottom: 4px; }
    .header .meta { font-size: 12px; color: #888; margin-bottom: 28px; }
    .service {
      border: 1px solid #e2e2e2;
      border-left: 5px solid #D6001C;
      border-radius: 6px;
      padding: 16px 18px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .service-name { font-size: 16px; font-weight: 700; margin-bottom: 4px; line-height: 1.3; }
    .badge {
      display: inline-block;
      background: #FFF8E1;
      color: #8B6914;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 2px 8px;
      border-radius: 3px;
      border: 1px solid #FFCD00;
      margin-bottom: 8px;
    }
    .contact-row { font-size: 12px; color: #444; line-height: 1.8; }
    .contact-row span { margin-right: 16px; }
    .section-divider {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #D6001C;
      margin: 12px 0 6px;
      padding-top: 10px;
      border-top: 1px solid #eee;
    }
    .steps { padding-left: 20px; margin: 0; }
    .steps li { font-size: 12px; color: #333; line-height: 1.6; margin-bottom: 2px; }
    .docs { padding-left: 18px; margin: 0; list-style: disc; }
    .docs li { font-size: 12px; color: #333; line-height: 1.6; margin-bottom: 2px; }
    .footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 3px solid #FFCD00;
      font-size: 11px;
      color: #888;
      display: flex;
      justify-content: space-between;
    }
  `;
  doc.head.appendChild(style);

  // Title
  const titleEl = doc.createElement("title");
  titleEl.textContent = "My Shortlist \u2014 Recovery on Campus Alberta";
  doc.head.appendChild(titleEl);

  // Header
  const header = doc.createElement("div");
  header.className = "header";

  const bar = doc.createElement("div");
  bar.className = "header-bar";
  header.appendChild(bar);

  const h1 = doc.createElement("h1");
  h1.textContent = "My Service Shortlist";
  header.appendChild(h1);

  const subtitle = doc.createElement("div");
  subtitle.className = "subtitle";
  subtitle.textContent = "Recovery on Campus Alberta";
  header.appendChild(subtitle);

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

  // Service cards
  for (const svc of services) {
    const card = doc.createElement("div");
    card.className = "service";

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
    if (options.includeRequiredDocs && svc.requiredDocs.length > 0) {
      const divider = doc.createElement("div");
      divider.className = "section-divider";
      divider.textContent = "What You'll Need";
      card.appendChild(divider);

      const ul = doc.createElement("ul");
      ul.className = "docs";
      for (const d of svc.requiredDocs) {
        const li = doc.createElement("li");
        li.textContent = d;
        ul.appendChild(li);
      }
      card.appendChild(ul);
    }

    doc.body.appendChild(card);
  }

  // Footer
  const footer = doc.createElement("div");
  footer.className = "footer";
  const footerLeft = doc.createElement("span");
  footerLeft.textContent = "Recovery on Campus Alberta \u00B7 ucalgary.ca/recovery-campus";
  const footerRight = doc.createElement("span");
  footerRight.textContent = `${services.length} service${services.length !== 1 ? "s" : ""}`;
  footer.appendChild(footerLeft);
  footer.appendChild(footerRight);
  doc.body.appendChild(footer);
}

export function MyShortlist({ isOpen, onClose }: MyShortlistProps) {
  const { favorites, favoriteCount, removeFavorite, clearFavorites } = useFavoritesContext();
  const { toast } = useToast();
  const panelRef = useFocusTrap(isOpen, onClose);
  const [confirmingClear, setConfirmingClear] = useState(false);
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
      setTimeout(() => printWindow.print(), 250);
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
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-snug break-words">
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
                    PDF Options
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
                      Preparing PDF…
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" aria-hidden="true" />
                      Export PDF
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
                  onBlur={() => setConfirmingClear(false)}
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

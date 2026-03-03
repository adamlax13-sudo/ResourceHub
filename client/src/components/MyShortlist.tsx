import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, FileText, Trash2 } from "lucide-react";
import { useFavoritesContext, type FavoriteService } from "@/hooks/use-favorites";
import { useToast } from "@/hooks/use-toast";
import { useFocusTrap } from "@/hooks/use-focus-trap";

interface MyShortlistProps {
  isOpen: boolean;
  onClose: () => void;
}

function buildPrintPage(doc: Document, favorites: FavoriteService[]): void {
  const style = doc.createElement("style");
  style.textContent = `
    body {
      font-family: Georgia, serif;
      max-width: 680px;
      margin: 0 auto;
      padding: 32px 24px;
      color: #1a1a1a;
    }
    h1 { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
    .subtitle { font-size: 13px; color: #555; margin-bottom: 28px; }
    .service {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .service-name { font-size: 16px; font-weight: bold; margin-bottom: 6px; }
    .service-meta { margin-bottom: 6px; }
    .badge {
      display: inline-block;
      background: #eef2ff;
      color: #4338ca;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 2px 8px;
      border-radius: 999px;
    }
    .service-location { font-size: 13px; color: #555; }
    .footer {
      margin-top: 32px;
      font-size: 12px;
      color: #888;
      border-top: 1px solid #eee;
      padding-top: 12px;
    }
  `;
  doc.head.appendChild(style);

  const titleEl = doc.createElement("title");
  titleEl.textContent = "My Shortlist — ResourceHub Alberta";
  doc.head.appendChild(titleEl);

  const h1 = doc.createElement("h1");
  h1.textContent = "My Service Shortlist";
  doc.body.appendChild(h1);

  const subtitle = doc.createElement("p");
  subtitle.className = "subtitle";
  subtitle.textContent = "Printed from ResourceHub Alberta — recoveryoncampusalberta.ca";
  doc.body.appendChild(subtitle);

  for (const fav of favorites) {
    const card = doc.createElement("div");
    card.className = "service";

    const nameEl = doc.createElement("div");
    nameEl.className = "service-name";
    nameEl.textContent = fav.name;
    card.appendChild(nameEl);

    const metaEl = doc.createElement("div");
    metaEl.className = "service-meta";
    const badge = doc.createElement("span");
    badge.className = "badge";
    badge.textContent = fav.category;
    metaEl.appendChild(badge);
    card.appendChild(metaEl);

    const locEl = doc.createElement("div");
    locEl.className = "service-location";
    locEl.textContent = `\u{1F4CD} ${fav.location}`;
    card.appendChild(locEl);

    doc.body.appendChild(card);
  }

  const footer = doc.createElement("div");
  footer.className = "footer";
  const dateStr = new Date().toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  footer.textContent = `Printed on ${dateStr} · ${favorites.length} service${favorites.length !== 1 ? "s" : ""}`;
  doc.body.appendChild(footer);
}

export function MyShortlist({ isOpen, onClose }: MyShortlistProps) {
  const { favorites, favoriteCount, removeFavorite, clearFavorites } = useFavoritesContext();
  const { toast } = useToast();
  const panelRef = useFocusTrap(isOpen, onClose);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const handleExportPDF = useCallback(() => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({
        title: "Popup blocked",
        description: "Please allow popups for this site to export your shortlist as PDF.",
        variant: "destructive",
      });
      return;
    }
    buildPrintPage(printWindow.document, favorites);
    // Give browser a tick to render styles before opening print dialog
    setTimeout(() => printWindow.print(), 250);
  }, [favorites, toast]);

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
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <FileText className="w-4 h-4" aria-hidden="true" />
                  Export PDF
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

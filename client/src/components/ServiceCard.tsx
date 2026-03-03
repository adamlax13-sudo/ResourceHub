import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock, ThumbsUp, ThumbsDown, Heart } from "lucide-react";
import { type ServiceSummary, type ServiceDetail } from "@shared/routes";
import { Badge } from "@/components/ui/badge";
import { useSearchContext } from "@/contexts/SearchContext";

const VOTES_STORAGE_KEY = 'roc_service_votes';

type VoteValue = 'up' | 'down';

function readStoredVotes(): Record<string, VoteValue> {
  try {
    const raw = localStorage.getItem(VOTES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, VoteValue>;
    }
  } catch {
    // ignore corrupt storage
  }
  return {};
}

function writeStoredVote(serviceId: string, vote: VoteValue): void {
  try {
    const current = readStoredVotes();
    current[serviceId] = vote;
    localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage errors
  }
}

interface ServiceCardProps {
  service: ServiceSummary;
  onClick: () => void;
  index: number;
  isFavorite?: boolean;
  onToggleFavorite?: (service: ServiceDetail) => void;
}

export function ServiceCard({ service, onClick, index, isFavorite = false, onToggleFavorite }: ServiceCardProps) {
  const { searchState } = useSearchContext();

  const [vote, setVote] = useState<VoteValue | null>(() => {
    const stored = readStoredVotes();
    return stored[service.id] ?? null;
  });

  const handleVote = useCallback((chosen: VoteValue, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (vote !== null) return; // already voted — no re-voting

    fetch('/api/service-vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: service.id,
        vote: chosen,
        queryContext: searchState.query,
      }),
    }).catch(() => {}); // fire and forget

    writeStoredVote(service.id, chosen);
    setVote(chosen);
  }, [vote, service.id, searchState.query]);

  const hasVoted = vote !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="group cursor-pointer h-full"
      role="button"
      tabIndex={0}
      aria-label={`View details for ${service.name} - ${service.category}`}
      data-testid={`card-service-${service.id}`}
    >
      <div className="glass-card h-full p-6 flex flex-col relative overflow-hidden group-hover:-translate-y-1 transition-transform duration-300">
        {/* Favorite (heart) button — top-right corner */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(service as unknown as ServiceDetail);
            }}
            className={`absolute top-3 right-3 z-10 p-1.5 rounded-full transition-colors ${
              isFavorite
                ? "text-red-500"
                : "text-muted-foreground/30 hover:text-red-400"
            }`}
            aria-label={isFavorite ? "Remove from shortlist" : "Save to shortlist"}
            aria-pressed={isFavorite}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} aria-hidden="true" />
          </button>
        )}

        {/* Geometric triangle accent - inspired by ROC logo */}
        <svg className="absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 text-primary/10 group-hover:text-primary/20 transition-colors" viewBox="0 0 100 100" fill="none">
          <polygon points="50,10 10,90 90,90" stroke="currentColor" strokeWidth="1" fill="none" />
          <polygon points="50,25 25,75 75,75" stroke="currentColor" strokeWidth="0.5" fill="none" />
          <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" strokeWidth="0.3" />
        </svg>

        <div className="flex justify-between items-start mb-4 min-w-0">
          <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors px-3 py-1 text-xs font-semibold uppercase tracking-wider whitespace-normal text-left max-w-full">
            {service.category}
          </Badge>
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors min-w-0 break-words hyphens-auto line-clamp-2">
          {service.name}
        </h3>

        <p className="text-muted-foreground mb-6 flex-grow min-w-0 break-words whitespace-normal overflow-wrap-anywhere">
          {service.description}
        </p>

        <div className="space-y-3 mt-auto">
          <div className="flex items-start text-sm text-slate-600">
            <MapPin className="w-4 h-4 mr-2 mt-0.5 text-primary/60 flex-shrink-0" aria-hidden="true" />
            <span className="break-words"><span className="sr-only">Location: </span>{service.location}</span>
          </div>
          <div className="flex items-start text-sm text-slate-600">
            <Clock className="w-4 h-4 mr-2 mt-0.5 text-primary/60 flex-shrink-0" aria-hidden="true" />
            <span className="break-words"><span className="sr-only">Wait time: </span>{service.waitTimes || "Contact service provider for wait time"}</span>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-primary font-medium text-sm">
          <span>View Details</span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="This result was helpful"
              aria-pressed={vote === 'up'}
              disabled={hasVoted}
              onClick={(e) => handleVote('up', e)}
              onKeyDown={(e) => e.key === 'Enter' && handleVote('up', e)}
              className={[
                "p-1 rounded transition-colors",
                hasVoted
                  ? "cursor-default"
                  : "hover:text-green-600 hover:bg-green-50",
                vote === 'up'
                  ? "text-green-600"
                  : vote === 'down'
                    ? "text-muted-foreground/30"
                    : "text-muted-foreground/50",
              ].join(' ')}
            >
              <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="This result was not helpful"
              aria-pressed={vote === 'down'}
              disabled={hasVoted}
              onClick={(e) => handleVote('down', e)}
              onKeyDown={(e) => e.key === 'Enter' && handleVote('down', e)}
              className={[
                "p-1 rounded transition-colors",
                hasVoted
                  ? "cursor-default"
                  : "hover:text-red-500 hover:bg-red-50",
                vote === 'down'
                  ? "text-red-500"
                  : "text-muted-foreground/50",
              ].join(' ')}
            >
              <ThumbsDown className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Layers, TrendingUp, ArrowUpRight } from 'lucide-react';

interface SuggestResponse {
  services: string[];
  categories: string[];
  queries: string[];
}

interface SearchSuggestionsProps {
  query: string;
  isVisible: boolean;
  onSelect: (suggestion: string) => void;
  onDismiss: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

/** Highlight the portion of text that matches the query */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase().trim();
  const idx = lower.indexOf(qLower);

  if (idx === -1 || !qLower) return <>{text}</>;

  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-foreground">{text.slice(idx, idx + qLower.length)}</span>
      {text.slice(idx + qLower.length)}
    </>
  );
}

export function SearchSuggestions({ query, isVisible, onSelect, onDismiss, anchorRef }: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SuggestResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevQueryRef = useRef('');

  // Build flat list — interleave: categories first, then services, then queries
  // No section headers, just differentiated by icon (Google-style)
  const flatList: { text: string; type: 'category' | 'service' | 'query' }[] = [];
  if (suggestions) {
    suggestions.categories.forEach(c => flatList.push({ text: c, type: 'category' }));
    suggestions.services.forEach(s => flatList.push({ text: s, type: 'service' }));
    suggestions.queries.forEach(q => flatList.push({ text: q, type: 'query' }));
  }

  // Fetch suggestions with debounce
  useEffect(() => {
    if (!isVisible || query.trim().length < 2) {
      // Don't clear immediately — keep showing previous results briefly to avoid flicker
      if (query.trim().length < 2) setSuggestions(null);
      return;
    }

    // Skip if query hasn't meaningfully changed
    if (query.trim() === prevQueryRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsLoading(true);

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(query.trim())}`, {
          signal: abortRef.current.signal,
        });
        if (res.ok) {
          const data: SuggestResponse = await res.json();
          const hasResults = data.services.length + data.categories.length + data.queries.length > 0;
          setSuggestions(hasResults ? data : null);
          setSelectedIndex(-1);
          prevQueryRef.current = query.trim();
        }
      } catch {
        // Aborted or network error
      } finally {
        setIsLoading(false);
      }
    }, 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isVisible]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!suggestions || flatList.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, flatList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      onSelect(flatList[selectedIndex].text);
    } else if (e.key === 'Escape') {
      onDismiss();
    }
  }, [suggestions, flatList, selectedIndex, onSelect, onDismiss]);

  useEffect(() => {
    if (isVisible && suggestions) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isVisible, suggestions, handleKeyDown]);

  // Click outside to dismiss
  useEffect(() => {
    if (!isVisible) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isVisible, onDismiss, anchorRef]);

  if (!isVisible || !suggestions || flatList.length === 0) return null;

  const iconForType = (type: string, isSelected: boolean) => {
    const cls = `w-4 h-4 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground/60'}`;
    switch (type) {
      case 'category': return <Layers className={cls} />;
      case 'service': return <ArrowUpRight className={cls} />;
      case 'query': return <Search className={cls} />;
      default: return <Search className={cls} />;
    }
  };

  const labelForType = (type: string) => {
    switch (type) {
      case 'category': return 'Category';
      case 'service': return 'Service';
      case 'query': return 'Search';
      default: return '';
    }
  };

  return (
    <div
      ref={containerRef}
      className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-border/40 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
      role="listbox"
    >
      <div className="py-1.5">
        {flatList.map((item, idx) => {
          const isSelected = selectedIndex === idx;
          return (
            <button
              key={`${item.type}-${item.text}`}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 ${
                isSelected
                  ? 'bg-primary/8'
                  : 'hover:bg-muted/40'
              }`}
              onMouseEnter={() => setSelectedIndex(idx)}
              onMouseDown={(e) => { e.preventDefault(); onSelect(item.text); }}
            >
              {iconForType(item.type, isSelected)}
              <span className={`flex-1 text-sm leading-tight ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                <HighlightMatch text={item.text} query={query} />
              </span>
              <span className={`text-[11px] shrink-0 ${isSelected ? 'text-primary/50' : 'text-muted-foreground/40'}`}>
                {labelForType(item.type)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Tag, TrendingUp } from 'lucide-react';

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
  /** Anchor element for positioning */
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function SearchSuggestions({ query, isVisible, onSelect, onDismiss, anchorRef }: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SuggestResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build flat list for keyboard navigation
  const flatList: { text: string; type: string }[] = [];
  if (suggestions) {
    suggestions.categories.forEach(c => flatList.push({ text: c, type: 'category' }));
    suggestions.services.forEach(s => flatList.push({ text: s, type: 'service' }));
    suggestions.queries.forEach(q => flatList.push({ text: q, type: 'query' }));
  }

  // Fetch suggestions with debounce
  useEffect(() => {
    if (!isVisible || query.trim().length < 2) {
      setSuggestions(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

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
        }
      } catch {
        // Aborted or network error — ignore
      }
    }, 200);

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

  const typeIcon = (type: string) => {
    switch (type) {
      case 'category': return <Tag className="w-4 h-4 text-primary/60" />;
      case 'service': return <Search className="w-4 h-4 text-muted-foreground" />;
      case 'query': return <TrendingUp className="w-4 h-4 text-muted-foreground" />;
      default: return null;
    }
  };

  let itemIndex = -1;

  return (
    <div
      ref={containerRef}
      className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-border/50 z-50 overflow-hidden"
      role="listbox"
    >
      {suggestions.categories.length > 0 && (
        <div>
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
            Categories
          </div>
          {suggestions.categories.map(cat => {
            itemIndex++;
            const idx = itemIndex;
            return (
              <button
                key={`cat-${cat}`}
                type="button"
                role="option"
                aria-selected={selectedIndex === idx}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                  selectedIndex === idx ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                }`}
                onMouseEnter={() => setSelectedIndex(idx)}
                onMouseDown={(e) => { e.preventDefault(); onSelect(cat); }}
              >
                {typeIcon('category')}
                <span>{cat}</span>
              </button>
            );
          })}
        </div>
      )}
      {suggestions.services.length > 0 && (
        <div>
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
            Services
          </div>
          {suggestions.services.map(svc => {
            itemIndex++;
            const idx = itemIndex;
            return (
              <button
                key={`svc-${svc}`}
                type="button"
                role="option"
                aria-selected={selectedIndex === idx}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                  selectedIndex === idx ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                }`}
                onMouseEnter={() => setSelectedIndex(idx)}
                onMouseDown={(e) => { e.preventDefault(); onSelect(svc); }}
              >
                {typeIcon('service')}
                <span className="truncate">{svc}</span>
              </button>
            );
          })}
        </div>
      )}
      {suggestions.queries.length > 0 && (
        <div>
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
            Popular Searches
          </div>
          {suggestions.queries.map(q => {
            itemIndex++;
            const idx = itemIndex;
            return (
              <button
                key={`q-${q}`}
                type="button"
                role="option"
                aria-selected={selectedIndex === idx}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                  selectedIndex === idx ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                }`}
                onMouseEnter={() => setSelectedIndex(idx)}
                onMouseDown={(e) => { e.preventDefault(); onSelect(q); }}
              >
                {typeIcon('query')}
                <span>{q}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

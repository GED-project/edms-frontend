import React, { useState, useRef, useEffect } from 'react';
import { X, Tag } from 'lucide-react';

interface TagEditorProps {
  tags: string[];
  allTags: string[]; // corpus of all existing tags for autocomplete
  onChange: (tags: string[]) => void;
  readonly?: boolean;
  compact?: boolean;
}

export function TagEditor({ tags, allTags, onChange, readonly = false, compact = false }: TagEditorProps) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = allTags.filter(
    (t) => t.toLowerCase().includes(input.toLowerCase()) && !tags.includes(t) && input.length > 0,
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
    if (e.key === 'Escape') {
      setFocused(false);
      setInput('');
    }
  };

  if (readonly) {
    if (tags.length === 0) return <span className="text-xs text-muted-foreground italic">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
          >
            <Tag className="h-2.5 w-2.5" />
            {tag}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex flex-wrap gap-1.5 rounded-lg border bg-background px-2.5 py-2 transition-all cursor-text ${
          focused
            ? 'border-ring ring-2 ring-ring/30'
            : 'border-input hover:border-ring/50'
        } ${compact ? 'min-h-[36px]' : 'min-h-[44px]'}`}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              className="rounded-full hover:bg-primary/20 transition-colors p-0.5"
              aria-label={`Supprimer le tag ${tag}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? 'Ajouter des tags (Entrée pour valider)…' : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {/* Autocomplete suggestions */}
      {focused && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-popover shadow-lg py-1 max-h-40 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); addTag(s); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors text-left"
            >
              <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
              {s}
            </button>
          ))}
        </div>
      )}

      {!compact && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Appuyez sur <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[9px]">Entrée</kbd> ou <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[9px]">,</kbd> pour ajouter un tag.
        </p>
      )}
    </div>
  );
}

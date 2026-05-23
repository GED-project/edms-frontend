import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  placeholder?: string;
}

export function CustomSelect({ id, value, onChange, options, className = '', placeholder }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-primary bg-white px-3 py-2 text-sm font-medium text-primary cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/40 hover:bg-primary/5"
      >
        <span className="truncate">{selected?.label ?? placeholder ?? ''}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-full w-max max-h-64 overflow-y-auto rounded-xl border border-border bg-white shadow-xl shadow-black/15 py-1 animate-in fade-in-0 zoom-in-95">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={[
                  'flex w-full items-center px-4 py-2.5 text-sm text-left transition-colors duration-100',
                  isSelected
                    ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary'
                    : 'text-foreground hover:bg-primary/10 hover:text-primary',
                ].join(' ')}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

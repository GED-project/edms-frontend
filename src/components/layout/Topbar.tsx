import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Bell, Sun, Moon, Monitor, Search, ChevronDown, X, ArrowLeft } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/providers/auth-provider';
import { useAvatar } from '@/lib/useAvatar';
import { useDebounce } from '@/lib/use-debounce';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/documents': 'Document Library',
  '/admin': 'Administration',
  '/settings': 'Paramètres',
  '/activity': 'Activité',
  '/reports': 'Rapports',
  '/audit': 'Audit Log',
  '/integrations': 'Intégrations',
};

interface TopbarProps {
  onMobileMenuOpen: () => void;
  sidebarCollapsed: boolean;
}

export function Topbar({ onMobileMenuOpen, sidebarCollapsed }: TopbarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { avatarUrl, initials } = useAvatar();
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [highlightIdx, setHighlightIdx] = React.useState(-1);

  const debouncedSearch = useDebounce(searchValue, 300);

  // Refs for click-outside handling
  const notifRef = React.useRef<HTMLDivElement>(null);
  const profileRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Build autocomplete suggestions from localStorage documents
  const buildSuggestions = React.useCallback((q: string): string[] => {
    if (!q.trim() || q.length < 2) return [];
    try {
      const raw = localStorage.getItem('edms_documents_v2');
      const docs: Array<{ name: string; type: string; deleted?: boolean; tags?: string[]; metadata?: any }> =
        raw ? JSON.parse(raw) : [];
      const lower = q.toLowerCase();
      const names = docs
        .filter((d) => !d.deleted && d.type !== 'folder')
        .map((d) => d.name)
        .filter((n) => n.toLowerCase().includes(lower));
        
      const contents = docs
        .filter((d) => !d.deleted && d.type !== 'folder')
        .filter((d) => {
          const ocrText = (d.metadata as any)?.ocrText || '';
          return ocrText.toLowerCase().includes(lower);
        })
        .map((d) => `📄 Contenu dans: ${d.name}`);

      const tags = Array.from(new Set(docs.flatMap((d) => d.tags ?? [])))
        .filter((t) => t.toLowerCase().includes(lower))
        .map((t) => `🏷 ${t}`);
        
      return [...new Set([...names, ...contents, ...tags])].slice(0, 7);
    } catch {
      return [];
    }
  }, []);

  // Update suggestions when debounced value changes
  React.useEffect(() => {
    const s = buildSuggestions(debouncedSearch);
    setSuggestions(s);
    if (s.length > 0 && debouncedSearch.trim().length >= 2) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [debouncedSearch, buildSuggestions]);

  const commitSearch = React.useCallback((val: string) => {
    let q = val.replace(/^🏷 /, '').trim();
    q = q.replace(/^📄 Contenu dans: /, '').trim();
    if (!q) return;
    setShowSuggestions(false);
    setHighlightIdx(-1);
    navigate(`/documents?q=${encodeURIComponent(q)}`);
  }, [navigate]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = highlightIdx >= 0 && suggestions[highlightIdx]
        ? suggestions[highlightIdx]
        : searchValue;
      commitSearch(chosen);
      return;
    }
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const pageTitle = PAGE_TITLES[pathname] ?? 'EDMS';

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  const notifications = [
    { text: 'Rapport Q1 2025 approuvé par Manager', time: 'il y a 2h', dot: 'bg-green-500' },
    { text: '3 documents en attente de validation', time: 'il y a 5h', dot: 'bg-amber-500' },
    { text: 'Nouveau utilisateur enregistré', time: 'hier', dot: 'bg-blue-500' },
  ];

  return (
    <header
      className={[
        'fixed top-0 right-0 z-20 flex h-16 items-center gap-4 border-b border-border/60 bg-background/95 backdrop-blur-md px-4 lg:px-6 transition-all duration-300',
        sidebarCollapsed ? 'left-[70px]' : 'left-0 lg:left-[230px]',
      ].join(' ')}
    >
      {/* Mobile hamburger */}
      <button
        onClick={onMobileMenuOpen}
        className="lg:hidden -ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Page Title & Back Button */}
      <div className="hidden md:flex items-center gap-2 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Retour"
          title="Retour"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-base font-bold text-foreground">
          {pageTitle}
        </h2>
      </div>

      {/* Centered Search Bar */}
      <div className="flex-1 flex items-center justify-center px-4 max-w-2xl mx-auto">
        <div className="relative w-full" ref={searchRef}>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <input
            id="topbar-search"
            type="text"
            placeholder="Rechercher un document, tag ou dossier…"
            value={searchValue}
            onChange={(e) => { setSearchValue(e.target.value); setHighlightIdx(-1); }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (debouncedSearch.trim().length >= 2 && suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            autoComplete="off"
            className="w-full rounded-xl border border-border/80 bg-muted/40 px-4 py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
          {searchValue && (
            <button
              onClick={() => { setSearchValue(''); setSuggestions([]); setShowSuggestions(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors"
              aria-label="Effacer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-border bg-popover shadow-2xl shadow-black/10 overflow-hidden animate-in fade-in-0 zoom-in-95">
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Suggestions
              </p>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onMouseDown={(e) => { e.preventDefault(); commitSearch(s); }}
                  onMouseEnter={() => setHighlightIdx(i)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors ${
                    i === highlightIdx ? 'bg-accent text-foreground' : 'hover:bg-accent/60'
                  }`}
                >
                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{s}</span>
                </button>
              ))}
              <div className="border-t border-border/50 px-3 py-2">
                <button
                  onMouseDown={(e) => { e.preventDefault(); commitSearch(searchValue); }}
                  className="flex w-full items-center gap-2 text-xs text-primary font-medium hover:underline"
                >
                  <Search className="h-3 w-3" />
                  Voir tous les résultats pour &ldquo;{searchValue}&rdquo;
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-6 shrink-0 pr-2">

        {/* Theme Toggle */}
        <button
          onClick={cycleTheme}
          title={`Theme: ${theme}`}
          className="hidden md:flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
          aria-label="Change theme"
        >
          <ThemeIcon className="h-4 w-4" />
        </button>

        {/* Notifications Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen((v) => !v); setProfileOpen(false); }}
            className="relative flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-[22px] w-[22px] stroke-[1.5]" />
            <span className="absolute top-[-2px] right-[-2px] h-2 w-2 rounded-full bg-red-500 border border-white" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-10 w-80 rounded-2xl border border-border bg-popover shadow-2xl shadow-black/10 overflow-hidden z-50 animate-in fade-in-0 zoom-in-95">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Notifications</p>
                <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {notifications.length} new
                </span>
              </div>
              <div className="py-1">
                {notifications.map((n, i) => (
                  <button
                    key={i}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors text-left"
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.dot}`} />
                    <div>
                      <p className="text-xs text-foreground leading-snug">{n.text}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-border">
                <button
                  onClick={() => { navigate('/activity'); setNotifOpen(false); }}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  Voir toute l&apos;activité →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile Menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false); }}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            aria-label="User menu"
          >
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gray-100 text-[12px] font-bold text-gray-600 border border-gray-200 overflow-hidden">
              {avatarUrl
                ? <img src={avatarUrl} alt={user?.fullName ?? ''} className="h-full w-full object-cover" />
                : initials
              }
            </div>
            <span className="hidden sm:block text-[14px] font-bold text-gray-700 tracking-wide">
              {user?.fullName ?? 'Ali Husni'}
            </span>
            <ChevronDown className="h-4 w-4 text-gray-600 hidden sm:block stroke-[2]" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-11 w-52 rounded-xl border border-border bg-popover shadow-2xl z-50 overflow-hidden animate-in fade-in-0 zoom-in-95">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold text-foreground truncate">{user?.fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email ?? user?.role}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  Profile &amp; Settings
                </button>
                <div className="border-t border-border my-1" />
                <button
                  onClick={() => navigate('/auth/login')}
                  className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

import React, { useState } from 'react';
import { X, Cloud, CheckCircle2, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CloudImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (files: { name: string; size: string; type: 'pdf' | 'excel' | 'other' }[]) => void;
}

type CloudProvider = 'googledrive' | 'onedrive' | 'dropbox';

interface CloudFile {
  id: string;
  name: string;
  size: string;
  type: 'pdf' | 'excel' | 'other' | 'folder';
  modified: string;
  icon: string;
}

const CLOUD_MOCKS: Record<CloudProvider, { label: string; color: string; files: CloudFile[] }> = {
  googledrive: {
    label: 'Google Drive',
    color: '#4285F4',
    files: [
      { id: 'g1', name: 'Rapport Marketing Q1.pdf', size: '2.4 MB', type: 'pdf', modified: '02/05/2025', icon: '📄' },
      { id: 'g2', name: 'Budget Prévisionnel.xlsx', size: '1.1 MB', type: 'excel', modified: '01/05/2025', icon: '📊' },
      { id: 'g3', name: 'Dossier Clients', size: '--', type: 'folder', modified: '30/04/2025', icon: '📁' },
      { id: 'g4', name: 'Contrat Signé 2025.pdf', size: '543 KB', type: 'pdf', modified: '28/04/2025', icon: '📄' },
      { id: 'g5', name: 'Plan Stratégique 2025.pdf', size: '3.2 MB', type: 'pdf', modified: '25/04/2025', icon: '📄' },
    ],
  },
  onedrive: {
    label: 'OneDrive',
    color: '#0078D4',
    files: [
      { id: 'o1', name: 'Présentation Direction.pptx', size: '8.7 MB', type: 'other', modified: '03/05/2025', icon: '📊' },
      { id: 'o2', name: 'Notes de réunion.docx', size: '234 KB', type: 'other', modified: '02/05/2025', icon: '📝' },
      { id: 'o3', name: 'Factures Q1 2025.xlsx', size: '1.8 MB', type: 'excel', modified: '01/05/2025', icon: '📊' },
      { id: 'o4', name: 'Procédures internes.pdf', size: '980 KB', type: 'pdf', modified: '29/04/2025', icon: '📄' },
    ],
  },
  dropbox: {
    label: 'Dropbox',
    color: '#0061FF',
    files: [
      { id: 'd1', name: 'Design Assets.zip', size: '45 MB', type: 'other', modified: '03/05/2025', icon: '🗜️' },
      { id: 'd2', name: 'Charte Graphique v2.pdf', size: '5.6 MB', type: 'pdf', modified: '30/04/2025', icon: '📄' },
      { id: 'd3', name: 'Maquettes UI.png', size: '12 MB', type: 'other', modified: '27/04/2025', icon: '🖼️' },
      { id: 'd4', name: 'Spécifications Techniques.pdf', size: '2.3 MB', type: 'pdf', modified: '22/04/2025', icon: '📄' },
      { id: 'd5', name: 'Données Export.xlsx', size: '4.1 MB', type: 'excel', modified: '20/04/2025', icon: '📊' },
    ],
  },
};

const PROVIDER_LOGOS: Record<CloudProvider, React.ReactNode> = {
  googledrive: (
    <svg viewBox="0 0 87.3 78" className="h-5 w-5">
      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H.1c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
      <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 00-1.2 4.5h27.5z" fill="#00ac47"/>
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L87.3 57c0-1.55-.4-3.1-1.2-4.5H58.6l5.85 12.25z" fill="#ea4335"/>
      <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
      <path d="M59.8 52.5H27.5L13.75 76.3c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
      <path d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 27.5H87.2c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
    </svg>
  ),
  onedrive: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path d="M19.5 12.5a4 4 0 00-3.5-4 6 6 0 00-11.5 1.7A3.5 3.5 0 005 17h14a3.5 3.5 0 00.5-4.5z" fill="#0078D4"/>
    </svg>
  ),
  dropbox: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#0061FF">
      <path d="M6 2L12 6l-6 4 6 4-6 4-6-4 6-4-6-4zm12 0l6 4-6 4 6 4-6 4-6-4 6-4-6-4z"/>
    </svg>
  ),
};

export function CloudImportModal({ isOpen, onClose, onImportSuccess }: CloudImportModalProps) {
  const [provider, setProvider] = useState<CloudProvider>('googledrive');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState<Record<CloudProvider, boolean>>({
    googledrive: false,
    onedrive: false,
    dropbox: false,
  });

  if (!isOpen) return null;

  const providerData = CLOUD_MOCKS[provider];
  const filtered = providerData.files.filter(
    (f) => f.type !== 'folder' && f.name.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleConnect = async () => {
    setConnecting(true);
    await new Promise((r) => setTimeout(r, 1500));
    setConnected((prev) => ({ ...prev, [provider]: true }));
    setConnecting(false);
    toast.success(`Connecté à ${providerData.label}`);
  };

  const handleImport = () => {
    const toImport = providerData.files.filter((f) => selected.has(f.id));
    onImportSuccess(toImport.map((f) => ({ name: f.name, size: f.size, type: f.type === 'folder' ? 'other' : f.type })));
    toast.success(`${toImport.length} fichier(s) importé(s) depuis ${providerData.label}`);
    onClose();
    setSelected(new Set());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-2xl max-h-[85vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10">
              <Cloud className="h-5 w-5 text-sky-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Importer depuis le cloud</h2>
              <p className="text-xs text-muted-foreground">Choisissez un service et sélectionnez vos fichiers</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Provider tabs */}
        <div className="flex border-b border-border px-6 pt-4 gap-1">
          {(Object.keys(CLOUD_MOCKS) as CloudProvider[]).map((p) => (
            <button
              key={p}
              onClick={() => { setProvider(p); setSelected(new Set()); setSearch(''); }}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                provider === p
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              id={`cloud-tab-${p}`}
            >
              {PROVIDER_LOGOS[p]}
              {CLOUD_MOCKS[p].label}
              {connected[p] && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {!connected[provider] ? (
            /* Connect CTA */
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-border bg-muted/30">
                {PROVIDER_LOGOS[provider]}
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-base font-semibold text-foreground">Connecter {providerData.label}</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Autorisez l'accès à votre compte {providerData.label} pour parcourir et importer vos fichiers.
                </p>
              </div>
              <button
                onClick={handleConnect}
                disabled={connecting}
                id={`connect-${provider}-btn`}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-sm"
              >
                {connecting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Connexion en cours…</>
                ) : (
                  <>Se connecter à {providerData.label}</>
                )}
              </button>
            </div>
          ) : (
            /* File Browser */
            <>
              <div className="px-6 pt-4 pb-3 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type="search"
                    placeholder={`Rechercher dans ${providerData.label}…`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1.5">
                {filtered.length === 0 && (
                  <div className="py-10 text-center text-sm text-muted-foreground">Aucun fichier trouvé.</div>
                )}
                {filtered.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => file.type !== 'folder' && toggleSelect(file.id)}
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                      selected.has(file.id)
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-transparent hover:border-border hover:bg-accent/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={selected.has(file.id)}
                      className="rounded border-input text-primary focus:ring-primary/50 cursor-pointer"
                    />
                    <span className="text-xl">{file.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-[11px] text-muted-foreground">{file.size} · Modifié le {file.modified}</p>
                    </div>
                    {selected.has(file.id) && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4 bg-muted/20">
          <p className="text-xs text-muted-foreground">
            {connected[provider] && selected.size > 0 ? `${selected.size} fichier(s) sélectionné(s)` : ''}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
              Annuler
            </button>
            {connected[provider] && (
              <button
                onClick={handleImport}
                disabled={selected.size === 0}
                id="cloud-import-btn"
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
              >
                <Cloud className="h-4 w-4" />
                Importer ({selected.size})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { X, Clock, RotateCcw } from 'lucide-react';
import { DocumentRow, DocumentVersion } from './page';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentRow | null;
  onRestore: (doc: DocumentRow, version: DocumentVersion) => void;
}

export function VersionHistoryModal({ isOpen, onClose, document, onRestore }: VersionHistoryModalProps) {
  if (!isOpen || !document) return null;

  // Ensure there's a base version if versions array is missing
  const versions = document.versions || [
    {
      id: document.id + '-v1',
      version: 1,
      size: document.size || '--',
      date: document.date,
      author: document.author || 'Système',
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Historique des versions</h2>
              <p className="text-sm text-muted-foreground truncate max-w-sm">{document.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="relative border-l-2 border-muted ml-3 space-y-8 pb-4">
            {versions.map((ver, index) => {
              const isCurrent = index === 0;
              return (
                <div key={ver.id} className="relative pl-6">
                  {/* Timeline Dot */}
                  <div className={`absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-4 border-card ${isCurrent ? 'bg-primary' : 'bg-muted-foreground'}`} />
                  
                  <div className={`rounded-xl border p-4 transition-colors ${isCurrent ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">Version {ver.version}</h3>
                          {isCurrent && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              Actuelle
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Modifié le {new Date(ver.date).toLocaleString('fr-FR')} par <span className="font-medium text-foreground">{ver.author}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Taille : {ver.size}</p>
                      </div>
                      
                      {!isCurrent && (
                        <button
                          onClick={() => onRestore(document, ver)}
                          className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors shadow-sm w-fit"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restaurer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-border px-6 py-4 bg-muted/20">
          <button
            onClick={onClose}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

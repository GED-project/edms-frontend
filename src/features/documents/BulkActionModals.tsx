import { useState } from 'react';
import {
  X,
  Calendar,
  Archive,
  Trash2,
  Share2,
  Tag,
  FolderInput,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { TagEditor } from './TagEditor';

// ─── Set Expiry Modal ────────────────────────────────────────────────────────

interface SetExpiryModalProps {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onConfirm: (date: string) => void;
}

export function SetExpiryModal({ isOpen, selectedCount, onClose, onConfirm }: SetExpiryModalProps) {
  const [date, setDate] = useState('');
  if (!isOpen) return null;
  const min = new Date().toISOString().split('T')[0];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
            <Calendar className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Définir une date d'expiration</h2>
            <p className="text-xs text-muted-foreground">{selectedCount} document(s) sélectionné(s)</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Date d'expiration</label>
          <input
            type="date"
            min={min}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            id="expiry-date-input"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">Annuler</button>
          <button
            onClick={() => { if (date) { onConfirm(date); onClose(); } }}
            disabled={!date}
            id="set-expiry-confirm-btn"
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm"
          >
            <CheckCircle2 className="h-4 w-4" />Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Archive Modal ───────────────────────────────────────────────────────────

interface ArchiveModalProps {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

export function ArchiveModal({ isOpen, selectedCount, onClose, onConfirm }: ArchiveModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-500/10">
            <Archive className="h-5 w-5 text-zinc-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Archiver les documents</h2>
            <p className="text-xs text-muted-foreground">{selectedCount} document(s) sélectionné(s)</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Les documents archivés ne sont plus affichés dans la vue principale mais restent accessibles via le filtre «&nbsp;Archivé&nbsp;».
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">Annuler</button>
          <button onClick={() => { onConfirm(); onClose(); }} id="archive-confirm-btn"
            className="flex items-center gap-2 rounded-lg bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors shadow-sm">
            <Archive className="h-4 w-4" />Archiver
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Delete Modal ───────────────────────────────────────────────────────

interface BulkDeleteModalProps {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

export function BulkDeleteModal({ isOpen, selectedCount, onClose, onConfirm }: BulkDeleteModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Supprimer les documents</h2>
            <p className="text-xs text-muted-foreground">{selectedCount} document(s) sélectionné(s)</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Ces documents seront déplacés vers la <strong>corbeille</strong>. Vous pourrez les restaurer depuis la vue Corbeille.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">Annuler</button>
          <button onClick={() => { onConfirm(); onClose(); }} id="bulk-delete-confirm-btn"
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors shadow-sm">
            <Trash2 className="h-4 w-4" />Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Share Modal ─────────────────────────────────────────────────────────────

interface ShareModalProps {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onConfirm: (emails: string[], permission: 'view' | 'edit') => void;
}

export function ShareModal({ isOpen, selectedCount, onClose, onConfirm }: ShareModalProps) {
  const [emailInput, setEmailInput] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  if (!isOpen) return null;

  const addEmail = () => {
    const trimmed = emailInput.trim();
    if (!trimmed || !trimmed.includes('@') || emails.includes(trimmed)) return;
    setEmails([...emails, trimmed]);
    setEmailInput('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10">
              <Share2 className="h-5 w-5 text-sky-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Partager</h2>
              <p className="text-xs text-muted-foreground">{selectedCount} document(s)</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Email input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Adresses e-mail</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); }}}
              placeholder="utilisateur@entreprise.fr"
              id="share-email-input"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
            <button onClick={addEmail} className="rounded-lg border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition-colors">Ajouter</button>
          </div>
          {emails.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {emails.map((email) => (
                <span key={email} className="flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs text-sky-600 dark:text-sky-400 font-medium">
                  {email}
                  <button onClick={() => setEmails(emails.filter((e) => e !== email))} className="rounded-full hover:bg-sky-500/20 transition-colors"><X className="h-2.5 w-2.5" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Permission */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Permission</label>
          <div className="flex gap-2">
            {(['view', 'edit'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPermission(p)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  permission === p ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground hover:text-foreground'
                }`}
              >
                {p === 'view' ? '👁 Lecture seule' : '✏️ Modification'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">Annuler</button>
          <button
            onClick={() => { onConfirm(emails, permission); onClose(); setEmails([]); }}
            disabled={emails.length === 0}
            id="share-confirm-btn"
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Share2 className="h-4 w-4" />Partager
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Tag Modal ──────────────────────────────────────────────────────────

interface BulkTagModalProps {
  isOpen: boolean;
  selectedCount: number;
  allTags: string[];
  onClose: () => void;
  onConfirm: (tags: string[]) => void;
}

export function BulkTagModal({ isOpen, selectedCount, allTags, onClose, onConfirm }: BulkTagModalProps) {
  const [tags, setTags] = useState<string[]>([]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Tag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Ajouter des tags</h2>
            <p className="text-xs text-muted-foreground">Appliquer à {selectedCount} document(s)</p>
          </div>
        </div>
        <TagEditor tags={tags} allTags={allTags} onChange={setTags} />
        <p className="text-xs text-muted-foreground">Les tags saisis seront <strong>ajoutés</strong> aux tags existants des documents sélectionnés.</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => { onClose(); setTags([]); }} className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">Annuler</button>
          <button
            onClick={() => { onConfirm(tags); onClose(); setTags([]); }}
            disabled={tags.length === 0}
            id="bulk-tag-confirm-btn"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Tag className="h-4 w-4" />Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Move to Folder Modal ────────────────────────────────────────────────────

interface MoveToFolderModalProps {
  isOpen: boolean;
  selectedCount: number;
  folders: { id: string; name: string }[];
  onClose: () => void;
  onConfirm: (folderId: string) => void;
}

export function MoveToFolderModal({ isOpen, selectedCount, folders, onClose, onConfirm }: MoveToFolderModalProps) {
  const [selectedFolder, setSelectedFolder] = useState('');
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
            <FolderInput className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Déplacer vers un dossier</h2>
            <p className="text-xs text-muted-foreground">{selectedCount} document(s) sélectionné(s)</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Dossier de destination</label>
          <select
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            id="move-folder-select"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 cursor-pointer"
          >
            <option value="">— Sélectionner un dossier —</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">Annuler</button>
          <button
            onClick={() => { if (selectedFolder) { onConfirm(selectedFolder); onClose(); setSelectedFolder(''); } }}
            disabled={!selectedFolder}
            id="move-folder-confirm-btn"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <FolderInput className="h-4 w-4" />Déplacer
          </button>
        </div>
      </div>
    </div>
  );
}

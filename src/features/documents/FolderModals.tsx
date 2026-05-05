import React, { useState, useEffect } from 'react';
import { X, Folder, AlertTriangle } from 'lucide-react';


// ─── Create Folder Modal ──────────────────────────────────────────────────────

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
  existingNames: string[];
}

export function CreateFolderModal({ isOpen, onClose, onCreate, existingNames }: CreateFolderModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    
    if (!trimmed) {
      setError('Le nom du dossier ne peut pas être vide');
      return;
    }
    if (existingNames.map(n => n.toLowerCase()).includes(trimmed.toLowerCase())) {
      setError('Un élément avec ce nom existe déjà dans ce dossier');
      return;
    }

    onCreate(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Nouveau dossier</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label htmlFor="folderName" className="block text-sm font-medium text-foreground mb-1">
              Nom du dossier
            </label>
            <input
              autoFocus
              id="folderName"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="ex: Projets 2025"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {error && <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Rename Folder Modal ──────────────────────────────────────────────────────

interface RenameFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newName: string) => void;
  initialName: string;
  existingNames: string[];
}

export function RenameFolderModal({ isOpen, onClose, onRename, initialName, existingNames }: RenameFolderModalProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setError('');
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    
    if (!trimmed) {
      setError('Le nom ne peut pas être vide');
      return;
    }
    if (trimmed !== initialName && existingNames.map(n => n.toLowerCase()).includes(trimmed.toLowerCase())) {
      setError('Un élément avec ce nom existe déjà');
      return;
    }

    onRename(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Renommer</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label htmlFor="rename" className="block text-sm font-medium text-foreground mb-1">
              Nouveau nom
            </label>
            <input
              autoFocus
              id="rename"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {error && <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  folderName: string;
  itemCount: number;
}

export function DeleteConfirmModal({ isOpen, onClose, onConfirm, folderName, itemCount }: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-red-500/10">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-500">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-base font-semibold">Supprimer le dossier</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-foreground">
            Êtes-vous sûr de vouloir supprimer le dossier <strong>{folderName}</strong> ?
          </p>
          <div className="rounded-lg bg-accent/50 p-3 text-sm text-muted-foreground">
            Ce dossier contient <strong>{itemCount}</strong> élément(s). La suppression sera définitive pour le dossier et l'ensemble de son contenu.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors shadow-sm"
            >
              Supprimer définitivement
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

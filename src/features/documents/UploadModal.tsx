import React, { useState, useRef, useEffect } from 'react';
import { X, UploadCloud, File, AlertCircle, CheckCircle2, XCircle, Tag, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { loadMetaFields, MetaFieldDefinition } from '@/lib/metadata-store';
import { TagEditor } from './TagEditor';

export interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (uploadedFiles: globalThis.File[], tags: string[], metadata: Record<string, string>) => void;
  /** corpus of all tags for autocomplete */
  allTags?: string[];
}

interface UploadFile {
  id: string;
  file: globalThis.File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMsg?: string;
}

type Step = 'files' | 'metadata';

const MAX_SIZE_MB = 10;
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export function UploadModal({ isOpen, onClose, onUploadSuccess, allTags = [] }: UploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState<Step>('files');
  const [tags, setTags] = useState<string[]>([]);
  const [metaValues, setMetaValues] = useState<Record<string, string>>({});
  const [metaErrors, setMetaErrors] = useState<Record<string, string>>({});
  const [metaFields, setMetaFields] = useState<MetaFieldDefinition[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalsRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      // Reset state when opening
      setFiles([]);
      setStep('files');
      setTags([]);
      setMetaValues({});
      setMetaErrors({});
      setMetaFields(loadMetaFields());
      
      // Clear any pending intervals
      Object.values(intervalsRef.current).forEach(clearInterval);
      intervalsRef.current = {};
    }
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // ── File validation ────────────────────────────────────────────────────────

  const validateFile = (file: globalThis.File): string | null => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return `Taille maximale dépassée (${MAX_SIZE_MB} Mo)`;
    if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.name.endsWith('.docx') && !file.name.endsWith('.xlsx'))
      return 'Type de fichier non autorisé.';
    return null;
  };

  const handleAddFiles = (newFiles: FileList | globalThis.File[]) => {
    const filesArray = Array.from(newFiles);
    const newUploadFiles: UploadFile[] = filesArray.map((f) => {
      const errorMsg = validateFile(f);
      return { id: Math.random().toString(36).substring(7), file: f, progress: 0, status: errorMsg ? 'error' : 'pending', errorMsg: errorMsg || undefined };
    });
    setFiles((prev) => [...prev, ...newUploadFiles]);
  };

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop      = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.length) handleAddFiles(e.dataTransfer.files);
  };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleAddFiles(e.target.files);
    e.target.value = '';
  };

  // ── Upload simulation ──────────────────────────────────────────────────────

  const startUpload = (fileId: string) => {
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, status: 'uploading' } : f)));
    let currentProgress = 0;
    
    const interval = setInterval(() => {
      currentProgress += Math.random() * 15 + 5;
      if (currentProgress >= 100) {
        clearInterval(interval);
        delete intervalsRef.current[fileId];
        setFiles((prev) => prev.map((f) => {
          if (f.id === fileId && f.status === 'uploading') {
            toast.success(`${f.file.name} uploadé avec succès`);
            return { ...f, progress: 100, status: 'success' };
          }
          return f;
        }));
      } else {
        setFiles((prev) => prev.map((f) => f.id === fileId && f.status === 'uploading' ? { ...f, progress: Math.min(currentProgress, 99) } : f));
      }
    }, 400);
    
    intervalsRef.current[fileId] = interval;
  };

  const removeOrCancel = (fileId: string) => {
    if (intervalsRef.current[fileId]) {
      clearInterval(intervalsRef.current[fileId]);
      delete intervalsRef.current[fileId];
    }
    
    setFiles((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (file?.status === 'uploading') toast.error(`Upload annulé pour ${file.file.name}`);
      return prev.filter((f) => f.id !== fileId);
    });
  };

  const startAllPending = () => files.filter((f) => f.status === 'pending').forEach((f) => startUpload(f.id));

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const hasPending = files.some((f) => f.status === 'pending');
  const allSuccessOrError = files.length > 0 && files.every((f) => f.status === 'success' || f.status === 'error');
  const hasSuccessful = files.some((f) => f.status === 'success');

  // ── Metadata validation ────────────────────────────────────────────────────

  const validateMeta = (): boolean => {
    const errors: Record<string, string> = {};
    for (const field of metaFields) {
      if (field.required && !metaValues[field.id]?.trim()) {
        errors[field.id] = 'Ce champ est obligatoire.';
      }
      if (field.type === 'number' && metaValues[field.id] && isNaN(Number(metaValues[field.id]))) {
        errors[field.id] = 'Veuillez saisir un nombre valide.';
      }
    }
    setMetaErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFinish = () => {
    if (!validateMeta()) return;
    onUploadSuccess(files.filter((f) => f.status === 'success').map((f) => f.file), tags, metaValues);
    onClose();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-xl max-h-[90vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">Importer des documents</h2>
            {/* Step indicator */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs">
              <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-colors ${step === 'files' ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                <span>1</span><span className="hidden sm:inline">Fichiers</span>
              </span>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-colors ${step === 'metadata' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                <span>2</span><span className="hidden sm:inline">Métadonnées</span>
              </span>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* ── STEP 1: Files ───────────────────────────────────────────── */}
          {step === 'files' && (
            <>
              {/* Dropzone */}
              <div
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/30'
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1 text-center">Glissez et déposez vos fichiers ici</p>
                <p className="text-xs text-muted-foreground mb-4 text-center">PDF, Word, Excel, Images jusqu'à {MAX_SIZE_MB} Mo.</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  Parcourir les fichiers
                </button>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.txt" />
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fichiers ({files.length})</h3>
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div key={file.id} className="relative overflow-hidden rounded-lg border border-border bg-background p-3">
                        {file.status === 'uploading' && (
                          <div className="absolute left-0 top-0 bottom-0 bg-primary/5 transition-all duration-300" style={{ width: `${file.progress}%` }} />
                        )}
                        <div className="relative flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-accent text-muted-foreground">
                            <File className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{file.file.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">{formatSize(file.file.size)}</span>
                              {file.status === 'error' && (
                                <span className="flex items-center gap-1 text-[10px] text-red-500 font-medium">
                                  <AlertCircle className="h-3 w-3" />{file.errorMsg}
                                </span>
                              )}
                              {file.status === 'uploading' && (
                                <span className="text-[10px] text-primary font-medium">En cours ({Math.round(file.progress)}%)</span>
                              )}
                              {file.status === 'success' && (
                                <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                                  <CheckCircle2 className="h-3 w-3" />Terminé
                                </span>
                              )}
                            </div>
                          </div>
                          <button onClick={() => removeOrCancel(file.id)} className="flex h-7 w-7 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-red-500 transition-colors" title={file.status === 'uploading' ? 'Annuler' : 'Retirer'}>
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── STEP 2: Metadata & Tags ──────────────────────────────────── */}
          {step === 'metadata' && (
            <div className="space-y-6">
              {/* Tags section */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Tag className="h-4 w-4 text-primary" />
                  Tags
                </label>
                <p className="text-xs text-muted-foreground">Ajoutez des tags pour faciliter la recherche et le filtrage.</p>
                <TagEditor
                  tags={tags}
                  allTags={allTags}
                  onChange={setTags}
                />
              </div>

              {/* Dynamic metadata fields */}
              {metaFields.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">Métadonnées du document</h3>
                  </div>
                  {metaFields.map((field) => (
                    <div key={field.id} className="space-y-1.5">
                      <label htmlFor={`meta-input-${field.id}`} className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        {field.label}
                        {field.required && <span className="text-red-500" aria-hidden="true">*</span>}
                      </label>

                      {/* Text */}
                      {field.type === 'text' && (
                        <input
                          id={`meta-input-${field.id}`}
                          type="text"
                          value={metaValues[field.id] || ''}
                          onChange={(e) => { setMetaValues((v) => ({ ...v, [field.id]: e.target.value })); setMetaErrors((e2) => ({ ...e2, [field.id]: '' })); }}
                          placeholder={field.placeholder || ''}
                          className={`w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 transition ${metaErrors[field.id] ? 'border-red-500' : 'border-input'}`}
                        />
                      )}

                      {/* Number */}
                      {field.type === 'number' && (
                        <input
                          id={`meta-input-${field.id}`}
                          type="number"
                          value={metaValues[field.id] || ''}
                          onChange={(e) => { setMetaValues((v) => ({ ...v, [field.id]: e.target.value })); setMetaErrors((e2) => ({ ...e2, [field.id]: '' })); }}
                          placeholder={field.placeholder || ''}
                          className={`w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 transition ${metaErrors[field.id] ? 'border-red-500' : 'border-input'}`}
                        />
                      )}

                      {/* Date */}
                      {field.type === 'date' && (
                        <input
                          id={`meta-input-${field.id}`}
                          type="date"
                          value={metaValues[field.id] || ''}
                          onChange={(e) => { setMetaValues((v) => ({ ...v, [field.id]: e.target.value })); setMetaErrors((e2) => ({ ...e2, [field.id]: '' })); }}
                          className={`w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 transition ${metaErrors[field.id] ? 'border-red-500' : 'border-input'}`}
                        />
                      )}

                      {/* List */}
                      {field.type === 'list' && (
                        <select
                          id={`meta-input-${field.id}`}
                          value={metaValues[field.id] || ''}
                          onChange={(e) => { setMetaValues((v) => ({ ...v, [field.id]: e.target.value })); setMetaErrors((e2) => ({ ...e2, [field.id]: '' })); }}
                          className={`w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 transition cursor-pointer ${metaErrors[field.id] ? 'border-red-500' : 'border-input'}`}
                        >
                          <option value="">— Sélectionner —</option>
                          {(field.options || []).map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}

                      {/* Error */}
                      {metaErrors[field.id] && (
                        <p className="flex items-center gap-1 text-xs text-red-500">
                          <AlertCircle className="h-3 w-3" />{metaErrors[field.id]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {metaFields.length === 0 && (
                <div className="rounded-lg border border-dashed border-border py-8 text-center">
                  <p className="text-sm text-muted-foreground">Aucun champ de métadonnées défini par l'administrateur.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4 bg-muted/20">
          {step === 'files' ? (
            <>
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                {allSuccessOrError ? 'Fermer' : 'Annuler'}
              </button>
              {allSuccessOrError && hasSuccessful ? (
                <button
                  onClick={() => setStep('metadata')}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                  id="upload-next-btn"
                >
                  Suivant — Métadonnées
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={startAllPending}
                  disabled={!hasPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                  id="upload-start-btn"
                >
                  Démarrer l'import
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('files')}
                className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                ← Retour
              </button>
              <button
                onClick={handleFinish}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                id="upload-finish-btn"
              >
                <CheckCircle2 className="h-4 w-4" />
                Terminer l'import
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  X, UploadCloud, File, AlertCircle, CheckCircle2, XCircle, Tag, 
  ChevronRight, ChevronLeft, Info, Send, History,
  FileText, Image as ImageIcon, Printer, Download, MoreVertical,
  RotateCcw, RotateCw, User, Calendar, ShieldCheck, MessageSquare,
  Search, Sliders, Check, Minus, Trash2, ScanLine, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { loadMetaFields, MetaFieldDefinition } from '../../lib/metadata-store';
import { TagEditor } from './TagEditor';
import { useAuth } from '../../providers/auth-provider';
import { activityLogger } from '../../lib/activity-logger';
import { DocumentRow } from './page';

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMsg?: string;
  previewUrl?: string;
  // Per-file metadata
  name: string;
  tags: string[];
  metaValues: Record<string, string>;
  description: string;
}

type Step = 1 | 2 | 3;

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

export function DocumentUploadPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const parentId = searchParams.get('folder') || null;
  const replaceId = searchParams.get('replace') || null;
  
  const [currentStep, setCurrentStep] = useState<Step>(searchParams.get('source') === 'scan' ? 2 : 1);
  const [files, setFiles] = useState<UploadFile[]>(() => {
    if (searchParams.get('source') === 'scan') {
      const lastScan = sessionStorage.getItem('edms_last_scan');
      if (lastScan) {
        try {
          const { name, ocrText } = JSON.parse(lastScan);
          const mockBlob = new Blob([ocrText], { type: 'application/pdf' });
          const mockFile = new File([mockBlob], `${name}.pdf`, { type: 'application/pdf' });
          return [{
            id: 'scan-result',
            file: mockFile,
            progress: 100,
            status: 'success',
            previewUrl: undefined,
            name: name || 'Document numérisé',
            tags: [],
            metaValues: { ocrText },
            description: ''
          }];
        } catch (e) {
          return [];
        }
      }
    }
    return [];
  });
  const [isDragging, setIsDragging] = useState(false);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [metaFields, setMetaFields] = useState<MetaFieldDefinition[]>([]);
  const [metaErrors, setMetaErrors] = useState<Record<string, string>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalsRef = useRef<Record<string, any>>({});

  useEffect(() => {
    setMetaFields(loadMetaFields());
    
    // Set meta values from session if coming from scan (for non-file metadata)
    if (searchParams.get('source') === 'scan') {
      const lastScan = sessionStorage.getItem('edms_last_scan');
      if (lastScan) {
        try {
          const { ocrText, department: scanDept, tags: scanTags, name: scanName } = JSON.parse(lastScan);
          setFiles(prev => prev.map(f => f.id === 'scan-result' ? {
            ...f,
            name: scanName || f.name,
            tags: scanTags || [],
            metaValues: { ...f.metaValues, ocrText, department: scanDept || '' }
          } : f));
          setActiveFileId('scan-result');
        } catch (e) {}
      }
    }

    return () => {
      // Cleanup previews
      files.forEach(f => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      Object.values(intervalsRef.current).forEach(clearInterval);
    };
  }, []);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return `Taille maximale dépassée (${MAX_SIZE_MB} Mo)`;
    if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.name.endsWith('.docx') && !file.name.endsWith('.xlsx'))
      return 'Type de fichier non autorisé.';
    return null;
  };

  const handleAddFiles = (newFiles: FileList | File[]) => {
    const filesArray = Array.from(newFiles);
    const newUploadFiles: UploadFile[] = filesArray.map((f) => {
      const errorMsg = validateFile(f);
      const isImage = f.type.startsWith('image/');
      const isPdf = f.type === 'application/pdf';
      return { 
        id: Math.random().toString(36).substring(7), 
        file: f, 
        progress: 0, 
        status: errorMsg ? 'error' : 'pending', 
        errorMsg: errorMsg || undefined,
        previewUrl: (isImage || isPdf) ? URL.createObjectURL(f) : undefined,
        name: f.name.replace(/\.[^.]+$/, ''),
        tags: [],
        metaValues: {},
        description: ''
      };
    });
    setFiles((prev) => {
      const next = [...prev, ...newUploadFiles];
      if (!activeFileId && next.length > 0) setActiveFileId(next[0].id);
      return next;
    });
    
    // Automatically start upload for new pending files
    newUploadFiles.filter(f => f.status === 'pending').forEach(f => startUpload(f.id));
  };

  const startUpload = (fileId: string) => {
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, status: 'uploading' } : f)));
    let currentProgress = 0;
    
    const interval = setInterval(() => {
      currentProgress += Math.random() * 20 + 10;
      if (currentProgress >= 100) {
        clearInterval(interval);
        delete intervalsRef.current[fileId];
        setFiles((prev) => prev.map((f) => {
          if (f.id === fileId && f.status === 'uploading') {
            return { ...f, progress: 100, status: 'success' };
          }
          return f;
        }));
      } else {
        setFiles((prev) => prev.map((f) => f.id === fileId && f.status === 'uploading' ? { ...f, progress: Math.min(currentProgress, 99) } : f));
      }
    }, 300);
    
    intervalsRef.current[fileId] = interval;
  };

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop      = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.length) handleAddFiles(e.dataTransfer.files);
  };

  const activeFile = files.find(f => f.id === activeFileId) || files[0];
  const allSuccess = files.length > 0 && files.every(f => f.status === 'success');

  const updateActiveFile = (updates: Partial<UploadFile>) => {
    if (!activeFileId && files.length > 0) {
       setFiles(prev => prev.map((f, i) => i === 0 ? { ...f, ...updates } : f));
       return;
    }
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, ...updates } : f));
  };

  const handleFinish = async () => {
    const successFiles = files.filter(f => f.status === 'success');
    if (successFiles.length === 0) {
      toast.error("Veuillez attendre que l'upload soit terminé.");
      return;
    }

    // 1. Validation for all files
    for (const f of successFiles) {
       if (!f.name.trim()) {
          toast.error(`Le document "${f.file.name}" doit avoir un nom.`);
          setActiveFileId(f.id);
          setCurrentStep(2);
          return;
       }
       
       const missing = metaFields.filter(field => field.required && !f.metaValues[field.id]);
       if (missing.length > 0) {
          toast.error(`Champs obligatoires manquants pour "${f.name}": ${missing.map(m => m.label).join(', ')}`);
          setActiveFileId(f.id);
          setCurrentStep(2);
          return;
       }
    }

    try {
      const saved = localStorage.getItem('edms_documents_v2');
      const parsed = saved ? JSON.parse(saved) as DocumentRow[] : [];
      
      if (replaceId) {
        // Replacement Mode: Update existing document with new version
        const file = successFiles[0];
        const newSize = file.file.size < 1048576 
          ? (file.file.size / 1024).toFixed(1) + ' KB' 
          : (file.file.size / 1048576).toFixed(1) + ' MB';
        
        const updatedDocs = parsed.map(doc => {
          if (doc.id === replaceId) {
            const currentVersions = doc.versions || [];
            const nextVersionNum = (currentVersions[0]?.version || 0) + 1;
            const newVersion = {
              id: Math.random().toString(36).substr(2, 9),
              version: nextVersionNum,
              size: newSize,
              date: new Date().toISOString(),
              author: user?.fullName || 'Utilisateur'
            };
            return {
              ...doc,
              name: file.name,
              size: newSize,
              date: new Date().toISOString(),
              author: user?.fullName || 'Utilisateur',
              tags: file.tags,
              department: file.metaValues.department || doc.department,
              metadata: { ...doc.metadata, ...file.metaValues, description: file.description },
              versions: [newVersion, ...currentVersions]
            };
          }
          return doc;
        });

        localStorage.setItem('edms_documents_v2', JSON.stringify(updatedDocs));
        toast.success("Nouvelle version créée avec succès");
      } else {
        // Standard Upload Mode: Create new documents
        const newDocs: DocumentRow[] = successFiles.map(f => ({
          id: Math.random().toString(36).substr(2, 9),
          name: f.name,
          type: f.file.type === 'application/pdf' ? 'pdf' : f.file.type.startsWith('image/') ? 'image' : 'other',
          extension: f.file.name.split('.').pop()?.toUpperCase() || 'FILE',
          size: f.file.size < 1048576 ? (f.file.size / 1024).toFixed(1) + ' KB' : (f.file.size / 1048576).toFixed(1) + ' MB',
          date: new Date().toISOString(),
          author: user?.fullName || 'Utilisateur',
          department: f.metaValues.department || 'Général',
          tags: f.tags,
          parentId: parentId,
          metadata: { ...f.metaValues, description: f.description },
          versions: [{
             id: Math.random().toString(36).substr(2, 9),
             version: 1,
             size: f.file.size < 1048576 ? (f.file.size / 1024).toFixed(1) + ' KB' : (f.file.size / 1048576).toFixed(1) + ' MB',
             date: new Date().toISOString(),
             author: user?.fullName || 'Utilisateur'
          }]
        }));
        
        localStorage.setItem('edms_documents_v2', JSON.stringify([...newDocs, ...parsed]));
        newDocs.forEach(d => activityLogger.log('upload', d.name, user?.fullName ?? 'Utilisateur', 'Document importé via le tunnel'));
        toast.success(`${newDocs.length} document(s) importé(s) avec succès`);
      }
      
      sessionStorage.removeItem('edms_last_scan');
      navigate('/documents');
    } catch (error) {
      console.error("Critical error during finish:", error);
      toast.error("Une erreur est survenue lors de l'enregistrement.");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] -m-5 bg-background overflow-hidden border border-border rounded-xl shadow-sm">
      <Helmet>
        <title>Importer des documents — EDMS</title>
      </Helmet>

      <input 
        ref={fileInputRef} 
        type="file" 
        multiple 
        className="hidden" 
        onChange={(e) => {
          if (e.target.files) {
            handleAddFiles(e.target.files);
            // Reset value so same file can be added again if deleted
            e.target.value = '';
          }
        }} 
      />

      {/* Header Toolbar */}
      <div className="h-14 px-6 border-b border-border bg-card flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
              <UploadCloud className="h-4 w-4" />
            </div>
            <h1 className="text-sm font-semibold text-foreground">Nouvel import de document</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
           {allSuccess && (
             <span className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full flex items-center gap-1.5 animate-in fade-in zoom-in">
               <CheckCircle2 className="h-3.5 w-3.5" /> Fichiers prêts
             </span>
           )}
           <button onClick={() => navigate(-1)} className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors">
             <X className="h-4 w-4" />
           </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <>
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col bg-accent/20 overflow-hidden relative">
            
            {currentStep === 1 && files.length === 0 ? (
              /* Empty State / Dropzone */
              <div className="flex-1 flex items-center justify-center p-12">
                 <div 
                   onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                   className={`w-full max-w-3xl aspect-[16/9] flex flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-all duration-300 bg-card/50 backdrop-blur-sm shadow-xl ${
                     isDragging ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border hover:border-primary/50'
                   }`}
                 >
                    <div className="relative mb-8">
                       <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150" />
                       <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary animate-bounce-slow">
                          <UploadCloud className="h-10 w-10" />
                       </div>
                    </div>
                    <h2 className="text-2xl font-black text-foreground mb-3 tracking-tight italic uppercase">Importation de documents</h2>
                    <p className="text-sm text-muted-foreground mb-8 max-w-md text-center leading-relaxed">
                      Faites glisser vos documents ici ou cliquez sur l'icône pour parcourir votre stockage local.
                    </p>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-3 bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-primary/20 hover:-translate-y-1"
                    >
                      Sélectionner des fichiers
                    </button>
                  </div>
               </div>
            ) : (
              /* Viewer or List */
              <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-500">
                 {/* Viewer Toolbar */}
                 <div className="h-12 px-6 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                       <div className="flex items-center gap-1 bg-accent/50 rounded-lg p-1">
                          <button className="p-1.5 hover:bg-background rounded-md text-muted-foreground hover:text-foreground"><Minus className="h-3.5 w-3.5" /></button>
                          <span className="text-[10px] font-bold px-2">100%</span>
                          <button className="p-1.5 hover:bg-background rounded-md text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
                       </div>
                       <span className="w-px h-4 bg-border mx-1" />
                       <button className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground"><RotateCcw className="h-3.5 w-3.5" /></button>
                       <button className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground"><RotateCw className="h-3.5 w-3.5" /></button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-accent/30 px-3 py-1.5 rounded-lg border border-border">
                          Page 1 sur 1
                       </div>
                    </div>
                 </div>
  
                 {/* Viewer Content */}
                 <div className="flex-1 overflow-y-auto p-10 flex justify-center bg-zinc-100 dark:bg-zinc-900/50">
                    {activeFile ? (
                        <div className="w-full max-w-[850px] bg-white dark:bg-zinc-800 shadow-2xl border border-border min-h-[1100px] relative animate-in zoom-in-95 duration-500 flex flex-col items-center justify-center p-10">
                          {activeFile.previewUrl && activeFile.file.type.startsWith('image/') ? (
                            <img src={activeFile.previewUrl} alt="Preview" className="max-w-full max-h-[80vh] object-contain rounded shadow-lg" />
                          ) : (
                            <div className="text-center space-y-6">
                               <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-lg ${activeFile.id === 'scan-result' ? 'bg-purple-500/10 text-purple-500' : 'bg-red-500/10 text-red-500'}`}>
                                  {activeFile.id === 'scan-result' ? <ScanLine className="h-10 w-10" /> : <FileText className="h-10 w-10" />}
                               </div>
                               <div>
                                  <h3 className="text-lg font-bold text-foreground mb-1">{activeFile.name}</h3>
                                  <p className="text-xs text-muted-foreground">
                                     {activeFile.id === 'scan-result' ? 'Résultat de la numérisation IA' : 'Aperçu non disponible en mode simulation'}
                                  </p>
                               </div>
                               <div className="bg-accent/50 p-6 rounded-2xl border border-border max-w-sm mx-auto text-left space-y-4">
                                  <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                                     <span>Type</span>
                                     <span className="text-foreground">{activeFile.id === 'scan-result' ? 'Document Scanné (PDF)' : activeFile.file.type || 'Fichier'}</span>
                                  </div>
                                  <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                                     <span>Taille</span>
                                     <span className="text-foreground">{(activeFile.file.size / 1024 / 1024).toFixed(2)} MB</span>
                                  </div>
                                  <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                                     <span>Status</span>
                                     <span className={activeFile.id === 'scan-result' ? 'text-purple-500' : 'text-emerald-500'}>
                                        {activeFile.id === 'scan-result' ? 'OCR Traité' : 'Scan OK'}
                                     </span>
                                  </div>
                               </div>
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 w-full h-2 bg-primary/30" />
                        </div>
                    ) : (
                      <div className="w-full max-w-[850px] bg-white dark:bg-zinc-800 shadow-2xl border border-border min-h-[1100px] flex items-center justify-center p-20 text-center">
                         <div className="space-y-6 max-w-md">
                            <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto">
                               <UploadCloud className="h-10 w-10" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground">Sélectionnez un document</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                               Veuillez sélectionner un fichier dans la liste pour modifier ses métadonnées.
                            </p>
                         </div>
                      </div>
                    )}
                 </div>
              </div>
            )}
          </div>
  
          {/* Right Sidebar: Steps & Form */}
          <div className="w-[400px] border-l border-border bg-card flex flex-col shrink-0 z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
            {/* Stepper Header */}
            <div className="p-6 border-b border-border bg-accent/10">
               <div className="flex items-center justify-between relative">
                  {/* Connector lines */}
                  <div className="absolute top-[18px] left-[15%] right-[15%] h-0.5 bg-border -z-0" />
                  <div className={`absolute top-[18px] left-[15%] transition-all duration-500 h-0.5 bg-primary -z-0`} style={{ width: currentStep === 1 ? '0%' : currentStep === 2 ? '35%' : '70%' }} />
  
                  <button 
                    onClick={() => setCurrentStep(1)}
                    className={`relative z-10 flex flex-col items-center gap-2 group transition-all duration-300 ${currentStep < 1 ? 'opacity-40' : 'opacity-100'}`}
                  >
                     <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300 ${currentStep === 1 ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-110' : 'bg-emerald-500 text-white'}`}>
                        {currentStep > 1 ? <Check className="h-4 w-4" /> : '01'}
                     </div>
                     <span className={`text-[9px] font-black uppercase tracking-widest ${currentStep === 1 ? 'text-primary' : 'text-muted-foreground'}`}>Upload</span>
                  </button>
  
                  <button 
                    onClick={() => files.length > 0 && setCurrentStep(2)}
                    disabled={files.length === 0}
                    className={`relative z-10 flex flex-col items-center gap-2 group transition-all duration-300 ${currentStep < 2 ? 'opacity-40' : 'opacity-100'}`}
                  >
                     <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300 ${currentStep === 2 ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-110' : currentStep > 2 ? 'bg-emerald-500 text-white' : 'bg-accent border border-border text-muted-foreground'}`}>
                        {currentStep > 2 ? <Check className="h-4 w-4" /> : '02'}
                     </div>
                     <span className={`text-[9px] font-black uppercase tracking-widest ${currentStep === 2 ? 'text-primary' : 'text-muted-foreground'}`}>Fiche</span>
                  </button>
  
                  <button 
                    onClick={() => files.length > 0 && setCurrentStep(3)}
                    disabled={files.length === 0}
                    className={`relative z-10 flex flex-col items-center gap-2 group transition-all duration-300 ${currentStep < 3 ? 'opacity-40' : 'opacity-100'}`}
                  >
                     <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300 ${currentStep === 3 ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-110' : 'bg-accent border border-border text-muted-foreground'}`}>
                        03
                     </div>
                     <span className={`text-[9px] font-black uppercase tracking-widest ${currentStep === 3 ? 'text-primary' : 'text-muted-foreground'}`}>Circuit</span>
                  </button>
               </div>
            </div>
  
            <div className="flex-1 overflow-y-auto custom-scrollbar">
               {currentStep === 1 && (
                  <div className="p-6 space-y-6 animate-in fade-in duration-300">
                     <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Liste des fichiers</h3>
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider"
                        >
                           Ajouter plus
                        </button>
                     </div>
                     
                     {files.length === 0 ? (
                        <div className="py-12 text-center border-2 border-dashed border-border rounded-2xl bg-accent/5">
                           <p className="text-xs text-muted-foreground px-10">Aucun fichier sélectionné pour le moment.</p>
                        </div>
                     ) : (
                        <div className="space-y-3">
                           {files.map(f => (
                              <div key={f.id} className="p-4 rounded-2xl border border-border bg-accent/5 flex items-center gap-4 group transition-all hover:bg-accent/10">
                                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                   f.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 
                                   f.status === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'
                                 }`}>
                                    {f.status === 'uploading' ? <RotateCcw className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold text-foreground truncate">{f.file.name}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{(f.file.size / 1024 / 1024).toFixed(2)} MB</p>
                                 </div>
                                 <button 
                                   onClick={() => setFiles(prev => prev.filter(p => p.id !== f.id))}
                                   className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-all"
                                 >
                                    <Trash2 className="h-3.5 w-3.5" />
                                 </button>
                              </div>
                           ))}
                        </div>
                     )}
  
                     <div className="bg-primary/5 rounded-2xl p-5 border border-primary/10 space-y-3">
                        <div className="flex items-center gap-2 text-primary">
                           <ShieldCheck className="h-4 w-4" />
                           <span className="text-[10px] font-black uppercase tracking-widest">Contrôle de sécurité</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                           Tous les documents téléchargés sont analysés par notre système antivirus et classés automatiquement via OCR.
                        </p>
                      </div>
                   </div>
                )}
  
                {currentStep === 2 && activeFile && (
                  <div className="p-6 space-y-8 animate-in fade-in duration-300">
                     {/* File Selector Tabs */}
                     {files.length > 1 && (
                       <div className="space-y-3">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Document à éditer ({files.indexOf(activeFile) + 1}/{files.length})</label>
                          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                             {files.map(f => (
                               <button
                                 key={f.id}
                                 onClick={() => setActiveFileId(f.id)}
                                 className={`shrink-0 px-3 py-2 rounded-lg text-[10px] font-bold border transition-all ${
                                   f.id === activeFileId 
                                   ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                                   : 'bg-accent/30 border-border text-muted-foreground hover:bg-accent'
                                 }`}
                               >
                                  <span className="max-w-[80px] truncate block">{f.name}</span>
                               </button>
                             ))}
                          </div>
                       </div>
                     )}
  
                     <div className="space-y-6">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nom du document</label>
                          <input 
                            type="text" 
                            placeholder="Entrez le nom du document"
                            value={activeFile.name}
                            onChange={(e) => updateActiveFile({ name: e.target.value })}
                            className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
  
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Auteur</label>
                            <div className="flex items-center gap-2 bg-accent/30 border border-border rounded-lg px-3 py-2">
                               <User className="h-3.5 w-3.5 text-muted-foreground" />
                               <span className="text-sm text-foreground truncate">{user?.fullName || 'N/A'}</span>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Date du jour</label>
                            <div className="flex items-center gap-2 bg-accent/30 border border-border rounded-lg px-3 py-2">
                               <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                               <span className="text-sm text-foreground">{new Date().toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
  
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Description</label>
                          <textarea 
                            rows={3}
                            placeholder="Ajoutez une description courte..."
                            value={activeFile.description}
                            onChange={(e) => updateActiveFile({ description: e.target.value })}
                            className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
  
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Étiquettes / Tags</label>
                          <TagEditor
                            tags={activeFile.tags}
                            allTags={[]}
                            onChange={(newTags) => updateActiveFile({ tags: newTags })}
                          />
                        </div>
  
                        <div className="pt-4 space-y-4">
                           <div className="flex items-center gap-2 pb-2 border-b border-border">
                             <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Champs spécifiques</h3>
                           </div>
                           {metaFields.map(field => (
                              <div key={field.id} className="space-y-1.5">
                                 <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                 </label>
                                 <input 
                                   type={field.type === 'date' ? 'date' : 'text'}
                                   value={activeFile.metaValues[field.id] || ''}
                                   onChange={(e) => updateActiveFile({ 
                                     metaValues: { ...activeFile.metaValues, [field.id]: e.target.value } 
                                   })}
                                   className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                                 />
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               )}
  
               {currentStep === 3 && (
                  <div className="p-6 space-y-8 animate-in fade-in duration-300">
                     <div className="space-y-6">
                        <div className="flex items-center justify-between">
                           <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Définition du circuit</h3>
                           <button className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:bg-primary/5 px-2 py-1 rounded transition-all">
                              <Plus className="h-3 w-3" /> Charger modèle
                           </button>
                        </div>
  
                        <div className="relative pl-6 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                           <div className="relative">
                              <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-card z-10" />
                              <div className="flex items-start justify-between">
                                 <div>
                                    <p className="text-xs font-bold text-foreground">Initiateur</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">{user?.fullName || 'Moi'}</p>
                                 </div>
                                 <span className="text-[10px] text-primary font-black uppercase italic">Automatique</span>
                              </div>
                           </div>
  
                           <div className="relative">
                              <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-border border-2 border-card z-10" />
                              <div className="space-y-3">
                                 <p className="text-xs font-bold text-foreground">Viser par</p>
                                 <select className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground appearance-none cursor-pointer">
                                    <option>Choisir un validateur...</option>
                                    <option>Jean Dupont (RH)</option>
                                    <option>Sara Andrews (Finance)</option>
                                    <option>Marc Lefebvre (Direction)</option>
                                 </select>
                              </div>
                           </div>
  
                           <div className="relative opacity-60">
                              <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-border border-2 border-card z-10" />
                              <div>
                                 <p className="text-xs font-bold text-foreground">Archivage Final</p>
                                 <p className="text-[11px] text-muted-foreground mt-0.5">Système de gestion documentaire</p>
                              </div>
                           </div>
                        </div>
  
                        <div className="bg-accent/30 rounded-2xl p-5 border border-border">
                           <label className="flex items-center gap-2 mb-3">
                              <input type="checkbox" className="rounded border-border bg-background text-primary" defaultChecked />
                              <span className="text-xs font-bold text-foreground">Notifier par email</span>
                           </label>
                           <p className="text-[10px] text-muted-foreground">Une notification sera envoyée à chaque étape du circuit aux personnes concernées.</p>
                        </div>
                     </div>
                  </div>
               )}
            </div>
  
            {/* Footer Navigation */}
            <div className="p-4 border-t border-border bg-card shrink-0">
               <div className="grid grid-cols-2 gap-3">
                  {currentStep === 1 ? (
                     <>
                        <button 
                          onClick={() => navigate(-1)}
                          className="flex items-center justify-center gap-2 py-3 border border-border bg-card hover:bg-accent text-foreground text-xs font-black uppercase tracking-widest rounded-2xl transition-all"
                        >
                           Annuler
                        </button>
                        <button 
                          onClick={() => setCurrentStep(2)}
                          disabled={files.length === 0}
                          className="flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 disabled:opacity-40 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 transition-all"
                        >
                           Suivant <ChevronRight className="h-4 w-4" />
                        </button>
                     </>
                  ) : currentStep === 2 ? (
                     <>
                        <button 
                          onClick={() => setCurrentStep(1)}
                          className="flex items-center justify-center gap-2 py-3 border border-border bg-card hover:bg-accent text-foreground text-xs font-black uppercase tracking-widest rounded-2xl transition-all"
                        >
                           <ChevronLeft className="h-4 w-4" /> Retour
                        </button>
                        <button 
                          onClick={() => setCurrentStep(3)}
                          className="flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 transition-all"
                        >
                           Suivant <ChevronRight className="h-4 w-4" />
                        </button>
                     </>
                  ) : (
                     <>
                        <button 
                          onClick={() => setCurrentStep(2)}
                          className="flex items-center justify-center gap-2 py-3 border border-border bg-card hover:bg-accent text-foreground text-xs font-black uppercase tracking-widest rounded-2xl transition-all"
                        >
                           <ChevronLeft className="h-4 w-4" /> Retour
                        </button>
                        <button 
                          onClick={handleFinish}
                          className="flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-600/20 transition-all"
                        >
                           <CheckCircle2 className="h-4 w-4" /> Terminer
                        </button>
                     </>
                  )}
               </div>
            </div>
          </div>
        </>
      </div>
    </div>
  );
}

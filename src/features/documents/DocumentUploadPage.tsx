import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import { 
  X, UploadCloud, CheckCircle2,
  ChevronRight, ChevronLeft,
  FileText,
  RotateCcw, RotateCw, User, Calendar, ShieldCheck,
  RefreshCw,
  Check, Minus, Trash2, ScanLine, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { getMetadataDefinitions, MetadataDefinitionDto, MetadataFieldType } from '../admin/metadata.service';
import { getShareableUsers, ShareableUserDto } from '../admin/admin.service';
import { TagEditor } from './TagEditor';
import { useAuth } from '../../providers/auth-provider';
import { activityLogger } from '../../lib/activity-logger';
import { createDocument } from './document.service';
import { useScanContext } from './scan-context';

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
  const { scannedImages, clearScanImages } = useScanContext();
  
  // ?lib=LIB_ID&folder=FOLDER_ID  OR legacy ?folder=LIB_ID
  const libId = searchParams.get('lib') || searchParams.get('folder');
  const folderId = searchParams.get('folder') && searchParams.get('lib') ? searchParams.get('folder') : null;
  
  const [currentStep, setCurrentStep] = useState<Step>(searchParams.get('source') === 'scan' ? 2 : 1);
  const [files, setFiles] = useState<UploadFile[]>([]);

  // Convert scanned image to PDF on component mount if coming from scan page
  useEffect(() => {
    if (searchParams.get('source') === 'scan' && scannedImages.length > 0 && files.length === 0) {
      (async () => {
        try {
          const scanMetadata = sessionStorage.getItem('edms_scan_metadata');
          const metadata = scanMetadata ? JSON.parse(scanMetadata) : {};
          
          // Convert one or more scanned images into a single PDF
          const pdfBlob = await convertImagesToPdf(scannedImages);
          const pdfFile = new File([pdfBlob], `${metadata.name || 'Document'}.pdf`, { type: 'application/pdf' });
          
          setFiles([{
            id: 'scan-result',
            file: pdfFile,
            progress: 100,
            status: 'success',
            previewUrl: undefined,
            name: metadata.name || 'Document numérisé',
            tags: metadata.tags || [],
            metaValues: { ocrText: metadata.ocrText || '' },
            description: ''
          }]);
          
          toast.success('Image convertie en PDF avec succès');
        } catch (error) {
          toast.error('Erreur lors de la conversion en PDF');
          console.error('PDF conversion error:', error);
          setFiles([]);
          navigate('/documents');
        } finally {
          clearScanImages();
        }
      })();
    }
  }, [searchParams, scannedImages, files.length, clearScanImages, navigate]);

  const convertImagesToPdf = async (imageFiles: File[]): Promise<Blob> => {
    if (imageFiles.length === 0) {
      throw new Error('No images provided for PDF conversion');
    }

    const toDataUrl = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
          });

          for (let i = 0; i < imageFiles.length; i++) {
            if (i > 0) {
              pdf.addPage('a4', 'portrait');
            }

            const file = imageFiles[i];
            const dataUrl = await toDataUrl(file);
            const img = await new Promise<HTMLImageElement>((resolveImage, rejectImage) => {
              const image = new Image();
              image.onload = () => resolveImage(image);
              image.onerror = () => rejectImage(new Error('Failed to load image'));
              image.src = dataUrl;
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 5;

            // Scale image to fit page with margins
            const maxWidth = pageWidth - (margin * 2);
            const maxHeight = pageHeight - (margin * 2);
            let finalWidth = maxWidth;
            let finalHeight = (img.height * maxWidth) / img.width;

            if (finalHeight > maxHeight) {
              finalHeight = maxHeight;
              finalWidth = (img.width * maxHeight) / img.height;
            }

            const x = (pageWidth - finalWidth) / 2;
            const y = (pageHeight - finalHeight) / 2;

            const imageFormat = file.type === 'image/png' ? 'PNG' : 'JPEG';
            pdf.addImage(
              dataUrl,
              imageFormat,
              x,
              y,
              finalWidth,
              finalHeight
            );
          }

          resolve(pdf.output('blob'));
        } catch (error) {
          reject(error);
        }
      })();
    });
  };
  
  const [isDragging, setIsDragging] = useState(false);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [metaFields, setMetaFields] = useState<MetadataDefinitionDto[]>([]);
  const [metaFieldsLoading, setMetaFieldsLoading] = useState(false);
  const [requestApproval, setRequestApproval] = useState(false);
  const [validators, setValidators] = useState<ShareableUserDto[]>([]);
  const [selectedValidatorId, setSelectedValidatorId] = useState('');

  const getMetaKey = (field: MetadataDefinitionDto) => field.name || field.id;

  const isMissingRequiredMetadata = (field: MetadataDefinitionDto, value: string | undefined) => {
    if (field.fieldType === MetadataFieldType.Boolean) {
      // For required checkboxes, only an explicit checked state is accepted.
      return value !== 'true';
    }

    return !value || !value.trim();
  };

  const loadMetadataDefinitions = React.useCallback(async () => {
    setMetaFieldsLoading(true);
    try {
      const r = await getMetadataDefinitions(0, 200);
      setMetaFields(r.items);
    } catch (e) {
      console.error('Failed to load metadata definitions', e);
      toast.error("Impossible de charger les champs de metadonnees");
    } finally {
      setMetaFieldsLoading(false);
    }
  }, []);

  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalsRef = useRef<Record<string, any>>({});

  useEffect(() => {
    loadMetadataDefinitions();

    getShareableUsers()
      .then((r) => {
        const candidates = r
          .sort((a, b) => a.userName.localeCompare(b.userName));
        setValidators(candidates);
      })
      .catch(() => {
        setValidators([]);
      });
    
    // Set meta values from session if coming from scan (for non-file metadata)
    if (searchParams.get('source') === 'scan') {
      const scanMetadata = sessionStorage.getItem('edms_scan_metadata');
      if (scanMetadata) {
        try {
          const { ocrText, department: scanDept, tags: scanTags, name: scanName } = JSON.parse(scanMetadata);
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
    // Mark file ready immediately — actual upload happens on Finish
    setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, progress: 100, status: 'success' } : f));
  };;

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
      toast.error("Veuillez sélectionner au moins un fichier.");
      return;
    }

    // Validation
    for (const f of successFiles) {
       if (!f.name.trim()) {
          toast.error(`Le document "${f.file.name}" doit avoir un nom.`);
          setActiveFileId(f.id);
          setCurrentStep(2);
          return;
       }
       const missing = metaFields.filter((field) => {
         const key = getMetaKey(field);
         return field.isRequired && isMissingRequiredMetadata(field, f.metaValues[key]);
       });
       if (missing.length > 0) {
         toast.error(`Champs obligatoires manquants pour "${f.name}": ${missing.map(m => m.displayName).join(', ')}`);
          setActiveFileId(f.id);
          setCurrentStep(2);
          return;
       }
    }

    // Mark all files as uploading
    setFiles(prev => prev.map(f => successFiles.some(s => s.id === f.id) ? { ...f, status: 'uploading', progress: 0 } : f));

    try {
      let succeeded = 0;
      for (const f of successFiles) {
        try {
          // Safety net: scan-origin image files must be stored as PDF.
          let fileToUpload = f.file;
          const isScanOrigin = searchParams.get('source') === 'scan' || f.id === 'scan-result';
          if (isScanOrigin && f.file.type.startsWith('image/')) {
            const pdfBlob = await convertImagesToPdf([f.file]);
            fileToUpload = new File([pdfBlob], `${f.name.trim() || 'Document'}.pdf`, { type: 'application/pdf' });
          }

          const fallbackOcrText = f.metaValues.ocrText || f.metaValues.OcrText;

          await createDocument(
            {
              title: f.name.trim(),
              description: f.description || undefined,
              folderId: folderId || undefined,
              libraryId: libId || undefined,
              requestApproval,
              approverUserId: requestApproval && selectedValidatorId ? selectedValidatorId : undefined,
              ocrText: fallbackOcrText,
              metadata: f.metaValues,
            },
            fileToUpload,
            (pct) => setFiles(prev => prev.map(u => u.id === f.id ? { ...u, progress: pct } : u)),
          );

          if (fileToUpload !== f.file) {
            setFiles(prev => prev.map(u => u.id === f.id ? { ...u, file: fileToUpload } : u));
          }

          setFiles(prev => prev.map(u => u.id === f.id ? { ...u, progress: 100, status: 'success' } : u));
          activityLogger.log('upload', f.name, user?.fullName ?? 'Utilisateur', 'Document importé');
          succeeded++;
        } catch (err: any) {
          const msg = err?.response?.data?.error?.message || `Échec pour "${f.name}"`;
          setFiles(prev => prev.map(u => u.id === f.id ? { ...u, status: 'error', errorMsg: msg } : u));
          toast.error(msg);
        }
      }

      if (succeeded > 0) {
        toast.success(
          requestApproval
            ? `${succeeded} document(s) importé(s) et envoyés en attente d'approbation`
            : `${succeeded} document(s) importé(s) avec succès`
        );
      }

      sessionStorage.removeItem('edms_scan_metadata');

      // Navigate back to the library or folder we came from
      if (libId) navigate(`/documents?lib=${libId}${folderId ? `&folder=${folderId}` : ''}`);
      else navigate('/documents');
    } catch (error) {
      console.error('Critical error during upload:', error);
      toast.error("Une erreur est survenue lors de l'enregistrement.");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] -m-5 bg-background overflow-hidden border border-border rounded-xl shadow-sm">
      <Helmet>
        <title>Importer des documents — ItDoc</title>
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
                            aria-label="Nom du document"
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
                            aria-label="Description du document"
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
                           <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
                             <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Champs spécifiques ({metaFields.length})</h3>
                             <button
                               type="button"
                               onClick={loadMetadataDefinitions}
                               className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                               disabled={metaFieldsLoading}
                             >
                               <RefreshCw className={`h-3 w-3 ${metaFieldsLoading ? 'animate-spin' : ''}`} />
                               Rafraichir
                             </button>
                           </div>
                           {metaFields.length === 0 && (
                             <p className="text-xs text-muted-foreground italic">Aucun champ de metadonnee defini. Verifiez que le manager a bien clique sur "Sauvegarder" dans Administration.</p>
                           )}
                           {metaFields.map(field => (
                              <div key={field.id} className="space-y-1.5">
                                 <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    {field.displayName} {field.isRequired && <span className="text-red-500">*</span>}
                                 </label>
                                 {field.fieldType === MetadataFieldType.DropdownList && field.dropdownOptions ? (
                                   <div className="relative">
                                     <select
                                       aria-label={field.displayName}
                                       value={activeFile.metaValues[getMetaKey(field)] || ''}
                                       onChange={(e) => updateActiveFile({ metaValues: { ...activeFile.metaValues, [getMetaKey(field)]: e.target.value } })}
                                       className="w-full appearance-none bg-background border border-input rounded-lg pl-3 pr-9 py-2 text-sm text-foreground shadow-xs transition-colors cursor-pointer hover:bg-accent/20 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:border-ring"
                                       style={{ colorScheme: 'light dark' }}
                                     >
                                       <option value="">Choisir…</option>
                                       {field.dropdownOptions.split(',').map((o: string) => o.trim()).filter(Boolean).map((o: string) => (
                                         <option key={o} value={o}>{o}</option>
                                       ))}
                                     </select>
                                     <ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rotate-90" />
                                   </div>
                                 ) : field.fieldType === MetadataFieldType.Boolean ? (
                                   <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                                     <input
                                       aria-label={field.displayName}
                                       type="checkbox"
                                       checked={activeFile.metaValues[getMetaKey(field)] === 'true'}
                                       onChange={(e) => updateActiveFile({ metaValues: { ...activeFile.metaValues, [getMetaKey(field)]: String(e.target.checked) } })}
                                       className="rounded border-input text-primary"
                                     />
                                     {field.displayName}
                                   </label>
                                 ) : field.fieldType === MetadataFieldType.Date ? (
                                   <div className="relative">
                                     <input
                                       aria-label={field.displayName}
                                       type="date"
                                       value={activeFile.metaValues[getMetaKey(field)] || ''}
                                       onChange={(e) => updateActiveFile({ metaValues: { ...activeFile.metaValues, [getMetaKey(field)]: e.target.value } })}
                                       className="w-full bg-background border border-input rounded-lg px-3 pr-9 py-2 text-sm text-foreground shadow-xs transition-colors [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:border-ring"
                                       style={{ colorScheme: 'light dark' }}
                                     />
                                     <Calendar className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                   </div>
                                 ) : (
                                   <input
                                     aria-label={field.displayName}
                                     type={field.fieldType === MetadataFieldType.Number ? 'number' : 'text'}
                                     value={activeFile.metaValues[getMetaKey(field)] || ''}
                                     onChange={(e) => updateActiveFile({ metaValues: { ...activeFile.metaValues, [getMetaKey(field)]: e.target.value } })}
                                     className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground/80 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:border-ring"
                                   />
                                 )}
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
                                 <select
                                   aria-label="Valideur"
                                   className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground appearance-none cursor-pointer disabled:opacity-60"
                                   value={selectedValidatorId}
                                   onChange={(e) => setSelectedValidatorId(e.target.value)}
                                   disabled={!libId || !requestApproval || validators.length === 0}
                                 >
                                    <option value="">Assignation automatique (manager de la bibliothèque)</option>
                                    {validators.map((v) => (
                                      <option key={v.id} value={v.id}>
                                        {(v.name || v.surname) ? `${v.name ?? ''} ${v.surname ?? ''}`.trim() : v.userName}
                                        {v.email ? ` (${v.email})` : ''}
                                      </option>
                                    ))}
                                 </select>
                                 {!requestApproval && (
                                   <p className="text-[10px] text-muted-foreground">Activez d'abord "Demander approbation" pour choisir un validateur.</p>
                                 )}
                                 {requestApproval && validators.length === 0 && (
                                   <p className="text-[10px] text-muted-foreground">Aucun manager trouvé, assignation automatique utilisée.</p>
                                 )}
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
                            <input
                              type="checkbox"
                              className="rounded border-border bg-background text-primary"
                              checked={requestApproval}
                              onChange={(e) => setRequestApproval(e.target.checked)}
                              disabled={!libId}
                            />
                            <span className="text-xs font-bold text-foreground">Demander approbation</span>
                          </label>
                          <p className="text-[10px] text-muted-foreground">
                            {libId
                             ? "Si activé, le document sera soumis pour révision et le manager propriétaire de la bibliothèque sera notifié."
                             : "Sélectionnez une bibliothèque pour activer la demande d'approbation."}
                          </p>
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

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import { Helmet } from 'react-helmet-async';
import { 
  ScanLine, CheckCircle2, RefreshCw,
  UploadCloud, Search, Info, ChevronLeft, ChevronRight, Check, X, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../providers/auth-provider';
import { ScreenLoader } from '../../components/screen-loader';
import { useScanContext } from './scan-context';
import * as docService from './document.service';
import { Permission } from '@/lib/auth-rbac/roles';

type ScanPhase = 'idle' | 'scanning' | 'processing' | 'done';

export function ScanDocumentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const libId = searchParams.get('lib');
  const folderId = searchParams.get('folder');
   const { isLoading, hasPermission } = useAuth();
   const { setScanImages: _setScanImages } = useScanContext();
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [ocrText, setOcrText] = useState('');
  const [docName, setDocName] = useState('');
  const [department, setDepartment] = useState('Général');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
   const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
   const ocrAbortRef = useRef<AbortController | null>(null);

  // Revoke the preview URL when it changes — never aborts the scan.
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  // Abort any in-flight OCR only when the component fully unmounts.
  useEffect(() => {
    return () => { ocrAbortRef.current?.abort(); };
  }, []);

  const handleReset = () => {
      ocrAbortRef.current?.abort();
      ocrAbortRef.current = null;
    setPhase('idle');
    setProgress(0);
    setOcrText('');
    setDocName('');
    setDepartment('Général');
    setSelectedTags([]);
    setIsSubmitting(false);
      setSelectedFiles([]);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
  };

   const handleStartScan = async (incomingFiles?: File[]) => {
      // Guard: permission check only (never block on isLoading for tenant users)
      if (!hasPermission(Permission.PERFORM_OCR)) {
         toast.error('Vous n\'avez pas la permission d\'utiliser l\'OCR.');
         return;
      }

      // Cancel any previous in-flight scan
      ocrAbortRef.current?.abort();
      const abort = new AbortController();
      ocrAbortRef.current = abort;

      const nextFiles = incomingFiles?.length
         ? [...selectedFiles, ...incomingFiles]
         : selectedFiles;

      if (nextFiles.length === 0) return;

      setSelectedFiles(nextFiles);
      setSelectedFile(nextFiles[0]);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(nextFiles[0]));

      // ── Scan animation ──────────────────────────────────────────────────────
      setPhase('scanning');
      setProgress(0);
      for (let i = 0; i <= 100; i += 10) {
         if (abort.signal.aborted) return;
         await new Promise((r) => setTimeout(r, 80));
         setProgress(i);
         if (i === 60) setPhase('processing');
      }

      if (abort.signal.aborted) return;

      // ── OCR call ────────────────────────────────────────────────────────────
      const fileName = nextFiles[0].name.replace(/\.[^.]+$/, '');
      let extractedText = '';

      try {
         const results = await Promise.all(
            nextFiles.map(async (f, idx) => {
               try {
                  console.log(`[OCR] Sending file ${f.name} (${f.size} bytes) to backend`);
                  const r = await docService.extractOcrPreview(f, abort.signal);
                  console.log(`[OCR] Response for file ${idx}:`, r);
                  return r.ocrText?.trim() ?? '';
               } catch (err: any) {
                  if (err?.name === 'CanceledError' || err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') {
                     throw err; // re-throw so outer catch handles it
                  }
                  console.error(`[OCR] File ${f.name} failed:`, err);
                  return '';
               }
            })
         );
         extractedText = results.filter(Boolean).join('\n\n');
      } catch (err: any) {
         const isCanceled = err?.name === 'CanceledError' || err?.name === 'AbortError' || err?.code === 'ERR_CANCELED';
         if (isCanceled || abort.signal.aborted) return; // user clicked Reset
         console.error('[OCR] Unexpected error:', err);
         extractedText = '';
      }

      if (abort.signal.aborted) return;

      // ── Always transition to done ────────────────────────────────────────────
      setOcrText(extractedText);
      setDocName(fileName);
      setPhase('done');
  };

  const handleConfirm = async () => {
    if (!docName.trim()) {
      toast.error('Veuillez saisir un nom pour le document.');
      return;
    }

      if (selectedFiles.length === 0) {
      toast.error('Aucun fichier sélectionné.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Convert scanned images to PDF HERE before navigating, so the upload
      // page receives a finished File object with no async work required.
      toast.info('Conversion en PDF…');
      const pdfFile = await convertToPdf(selectedFiles, docName);

      const scanMetadata = {
        name: docName,
        ocrText: ocrText,
        department: department,
        tags: selectedTags,
        originalFileName: selectedFiles[0].name,
        pageCount: selectedFiles.length,
        timestamp: new Date().toISOString()
      };
      sessionStorage.setItem('edms_scan_metadata', JSON.stringify(scanMetadata));

      navigate(
        `/documents/upload?source=scan${libId ? `&lib=${libId}` : ''}${folderId ? `&folder=${folderId}` : ''}`,
        { state: { pdfFile, scanMetadata } }
      );
    } catch (error) {
      toast.error('Erreur lors du traitement du scan');
      console.error('Scan error:', error);
      setIsSubmitting(false);
    }
  };

  // ── PDF conversion helper ─────────────────────────────────────────────────
  const convertToPdf = async (imageFiles: File[], name: string): Promise<File> => {
    const readDataUrl = (f: File) => new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(f);
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < imageFiles.length; i++) {
      if (i > 0) pdf.addPage('a4', 'portrait');
      const dataUrl = await readDataUrl(imageFiles[i]);
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const el = new Image();
        el.onload = () => res(el);
        el.onerror = rej;
        el.src = dataUrl;
      });
      const ratio = Math.min((pw - 10) / img.width, (ph - 10) / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      const fmt = imageFiles[i].type === 'image/png' ? 'PNG' : 'JPEG';
      pdf.addImage(dataUrl, fmt, 5, 5, w, h);
    }

    const blob = pdf.output('blob');
    return new File([blob], `${name || 'Document'}.pdf`, { type: 'application/pdf' });
  };

  return (
      isLoading ? <ScreenLoader /> :
    <div className="flex flex-col h-[calc(100vh-120px)] -m-5 bg-background overflow-hidden border border-border rounded-xl shadow-sm">
      <Helmet>
      <title>Numérisation intelligente — ItDoc</title>
      </Helmet>

      {/* Header Toolbar (Matches Upload Page) */}
      <div className="h-14 px-6 border-b border-border bg-card flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/documents')}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
              <ScanLine className="h-4 w-4" />
            </div>
            <h1 className="text-sm font-semibold text-foreground">Numérisation intelligente IA</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
           {phase === 'done' && (
             <span className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full flex items-center gap-1.5 animate-in fade-in zoom-in">
               <CheckCircle2 className="h-3.5 w-3.5" /> Extraction réussie
             </span>
           )}
           <button onClick={() => navigate('/documents')} className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors">
             <X className="h-4 w-4" />
           </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <>
          {/* Main Content Area (Matches Upload Page bg-accent/20) */}
          <div className="flex-1 flex flex-col bg-accent/20 overflow-hidden relative">
            
            {phase === 'idle' ? (
              /* Idle State: Big Dropzone Style */
              <div className="flex-1 flex items-center justify-center p-12">
                 <div className="w-full max-w-3xl aspect-[16/9] flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border transition-all duration-300 bg-card/50 backdrop-blur-sm shadow-xl hover:border-primary/50 group">
                    <div className="relative mb-8">
                       <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150" />
                       <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary animate-bounce-slow">
                          <UploadCloud className="h-10 w-10" />
                       </div>
                    </div>
                    <h2 className="text-2xl font-black text-foreground mb-3 tracking-tight italic uppercase">Démarrer le Scan</h2>
                    <p className="text-sm text-muted-foreground mb-8 max-w-md text-center leading-relaxed">
                      Déposez une image ou cliquez sur le bouton pour lancer l'analyse intelligente et l'extraction de métadonnées.
                    </p>
                              <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-3 bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-primary/20 hover:-translate-y-1"
                    >
                      Choisir un document
                    </button>
                              <input
                                 ref={fileInputRef}
                                 type="file"
                                 className="hidden"
                                 accept="image/*"
                                 multiple
                                 onChange={(e) => {
                                    if (!e.target.files?.length) return;
                                    handleStartScan(Array.from(e.target.files));
                                    e.target.value = '';
                                 }}
                              />
                 </div>
              </div>
            ) : (
              /* Active State: Professional Viewer Style */
              <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-500">
                 {/* Viewer Toolbar */}
                 <div className="h-12 px-6 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                       <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${phase === 'done' ? 'bg-emerald-500' : 'bg-primary animate-pulse'}`} />
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                             {phase === 'scanning' ? 'Numérisation...' : phase === 'processing' ? 'Analyse IA...' : 'Analyse terminée'}
                          </span>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-accent/30 px-3 py-1.5 rounded-lg border border-border">
                          Moteur OCR v4.2
                       </div>
                    </div>
                 </div>
  
                 {/* Viewer Content */}
                 <div className="flex-1 overflow-y-auto p-10 flex justify-center bg-zinc-100 dark:bg-zinc-900/50">
                    <div className="w-full max-w-[850px] bg-white dark:bg-zinc-800 shadow-2xl border border-border min-h-[1000px] relative animate-in zoom-in-95 duration-500 flex flex-col items-center justify-center p-10 overflow-hidden">
                       {/* Laser Animation for scanning */}
                       {(phase === 'scanning' || phase === 'processing') && (
                         <div 
                           className="absolute left-0 right-0 h-1 bg-primary/60 shadow-[0_0_20px_4px_rgba(var(--primary),0.4)] z-30 transition-all duration-300"
                           style={{ top: `${progress}%` }}
                         />
                       )}
  
                       {previewUrl ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
                             <img src={previewUrl} alt="Document" className="max-w-full max-h-full object-contain shadow-2xl" />
                             {(phase === 'scanning' || phase === 'processing') && (
                                <div className="absolute inset-0 bg-primary/10 backdrop-blur-[1px]" />
                             )}
                          </div>
                       ) : (
                          <div className="text-center space-y-6">
                             <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-lg transition-all duration-500 ${phase === 'done' ? 'bg-emerald-500 text-white rotate-0' : 'bg-primary/10 text-primary'}`}>
                                {phase === 'done' ? <CheckCircle2 className="h-12 w-12" /> : <ScanLine className="h-12 w-12 animate-pulse" />}
                             </div>
                             <div>
                                <h3 className="text-xl font-bold text-foreground mb-2">{selectedFile?.name || 'Document en cours...'}</h3>
                                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                   {phase === 'done' ? 'Données extraites avec succès.' : 'Analyse du contenu en cours...'}
                                </p>
                             </div>
                          </div>
                       )}
  
                          {phase === 'done' && (
                            <div className="relative z-40 bg-accent/90 backdrop-blur-sm p-6 rounded-2xl border border-border max-w-sm mx-auto text-left space-y-4 animate-in slide-in-from-bottom-4">
                               <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                                  <span>Confidence</span>
                                  <span className="text-emerald-500 font-black">98.4%</span>
                               </div>
                               <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                                  <span>Langue</span>
                                  <span className="text-foreground">
                                    {ocrText && /[؀-ۿ]/.test(ocrText) && /[a-zA-Z]/.test(ocrText)
                                      ? 'Arabe + Latin'
                                      : ocrText && /[؀-ۿ]/.test(ocrText)
                                      ? 'Arabe'
                                      : 'Français / Anglais'}
                                  </span>
                               </div>
                               <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                                  <span>Taille</span>
                                  <span className="text-foreground">{( (selectedFile?.size || 0) / (1024 * 1024) ).toFixed(2)} MB</span>
                               </div>
                            </div>
                          )}
  
                          {(phase === 'scanning' || phase === 'processing') && (
                             <div className="w-64 mx-auto space-y-3">
                                <div className="flex justify-between text-[10px] font-bold text-primary uppercase tracking-widest">
                                   <span>Progression</span>
                                   <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                                   <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                                </div>
                             </div>
                          )}
                    </div>
                 </div>
              </div>
            )}
          </div>
  
          {/* Right Sidebar (Matches Upload Page Sidebar) */}
          <div className="w-[400px] border-l border-border bg-card flex flex-col shrink-0 z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
            {/* Stepper (Simplified version of the Upload one) */}
            <div className="p-6 border-b border-border bg-accent/10">
               <div className="flex items-center justify-between relative px-4">
                  <div className="absolute top-[18px] left-[20%] right-[20%] h-0.5 bg-border -z-0" />
                  <div className="absolute top-[18px] left-[20%] h-0.5 bg-primary -z-0 transition-all duration-500" style={{ width: phase === 'done' ? '60%' : '0%' }} />
  
                  <div className="relative z-10 flex flex-col items-center gap-2">
                     <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${phase !== 'idle' ? 'bg-emerald-500 text-white' : 'bg-primary text-white shadow-lg'}`}>
                        {phase !== 'idle' ? <Check className="h-4 w-4" /> : '01'}
                     </div>
                     <span className="text-[9px] font-black uppercase tracking-widest text-primary">Scan</span>
                  </div>
  
                  <div className="relative z-10 flex flex-col items-center gap-2">
                     <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${phase === 'done' ? 'bg-primary text-white shadow-lg' : 'bg-accent border border-border text-muted-foreground opacity-40'}`}>
                        02
                     </div>
                     <span className={`text-[9px] font-black uppercase tracking-widest ${phase === 'done' ? 'text-primary' : 'text-muted-foreground opacity-40'}`}>Révision</span>
                  </div>
               </div>
            </div>
  
            {/* Form Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
               {phase !== 'done' ? (
                  <div className="p-10 flex flex-col items-center justify-center text-center space-y-6 opacity-30 h-full">
                     <Search className="h-12 w-12 text-muted-foreground" />
                     <div className="space-y-1">
                        <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Attente de données</h3>
                        <p className="text-[11px] text-muted-foreground max-w-[180px] leading-relaxed">
                           Lancez le scan pour voir les métadonnées extraites ici.
                        </p>
                     </div>
                  </div>
               ) : (
                  <div className="p-6 space-y-6 animate-in fade-in duration-500">

                     {/* ── OCR Result Banner ─────────────────────────────── */}
                     {ocrText.trim() ? (
                        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-start gap-3">
                           <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                           <div>
                              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                 Texte extrait avec succès
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                 {ocrText.trim().split(/\s+/).length} mots · {ocrText.trim().length} caractères
                              </p>
                           </div>
                        </div>
                     ) : (
                        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-3">
                           <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                           <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                              Aucun texte extrait. Vérifiez la qualité de l'image ou la langue du document.
                           </p>
                        </div>
                     )}

                     <div className="space-y-5">
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nom du document</label>
                           <input
                             type="text"
                             value={docName}
                             onChange={(e) => setDocName(e.target.value)}
                             className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                             placeholder="Nom du document..."
                           />
                        </div>

                        <div className="space-y-2">
                           <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between">
                              Texte Extrait (OCR)
                              <span className="text-[9px] text-primary italic font-medium">
                                 {ocrText.trim().length > 0 ? `${ocrText.trim().length} chars` : 'vide'}
                              </span>
                           </label>
                           <textarea
                             rows={12}
                             value={ocrText}
                             onChange={(e) => setOcrText(e.target.value)}
                             className={`w-full border rounded-lg px-3 py-2 text-xs text-foreground leading-relaxed resize-y focus:outline-none focus:ring-2 transition-all ${
                               ocrText.trim()
                                 ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-700 focus:ring-emerald-500/20'
                                 : 'bg-accent/30 border-border focus:ring-primary/20'
                             }`}
                             placeholder="Le texte OCR apparaîtra ici après l'analyse..."
                           />
                        </div>

                                    <div className="flex items-center justify-between rounded-lg border border-border bg-accent/30 px-3 py-2">
                                       <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pages scannées</span>
                                       <span className="text-xs font-bold text-foreground">{selectedFiles.length}</span>
                                    </div>
  
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Département</label>
                              <select 
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                                className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-[11px] font-bold text-foreground focus:outline-none"
                              >
                                 {['Général', 'RH', 'Finance', 'Juridique', 'IT', 'Marketing'].map(d => (
                                   <option key={d} value={d}>{d}</option>
                                 ))}
                              </select>
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mots-clés</label>
                              <input 
                                 type="text" 
                                 placeholder="Contrat, Facture..."
                                 className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-[11px] font-bold text-foreground focus:outline-none"
                                 onBlur={(e) => setSelectedTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                              />
                           </div>
                        </div>
  
                        <div className="bg-primary/5 rounded-2xl p-5 border border-primary/10 flex gap-4">
                           <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                           <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">
                              L'IA a classé ce document comme étant de type <span className="text-primary font-bold">Juridique</span> basé sur le contenu extrait.
                           </p>
                        </div>
                     </div>
                  </div>
               )}
            </div>
  
            {/* Sidebar Footer (Matches Upload Page Sidebar Footer) */}
            <div className="p-4 border-t border-border bg-card shrink-0">
               <div className="grid grid-cols-2 gap-3">
                  {phase === 'idle' ? (
                     <>
                        <button 
                          onClick={() => navigate('/documents')}
                          className="flex items-center justify-center gap-2 py-3 border border-border bg-card hover:bg-accent text-foreground text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all"
                        >
                           Annuler
                        </button>
                        <button 
                          disabled
                          className="flex items-center justify-center gap-2 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-2xl cursor-not-allowed opacity-50"
                        >
                           Scanner <ChevronRight className="h-3 w-3" />
                        </button>
                     </>
                  ) : (
                     <>
                        <button 
                          onClick={handleReset}
                          className="flex items-center justify-center gap-2 py-3 border border-border bg-card hover:bg-accent text-foreground text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all"
                        >
                           <RotateCcw className="h-3 w-3" /> Reset
                        </button>
                        <button 
                          onClick={handleConfirm}
                          disabled={phase !== 'done' || isSubmitting}
                          className={`flex items-center justify-center gap-2 py-3 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all ${
                             phase === 'done' 
                             ? 'bg-primary hover:bg-primary/90 shadow-primary/20' 
                             : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                          }`}
                        >
                           {isSubmitting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                           {isSubmitting ? 'Import...' : 'Confirmer'}
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

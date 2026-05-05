import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  ScanLine, CheckCircle2, RefreshCw, FileText, ArrowLeft, 
  UploadCloud, Search, Info, Tag, Layers, ChevronLeft, ChevronRight, Check, Trash2, X, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../providers/auth-provider';

type ScanPhase = 'idle' | 'scanning' | 'processing' | 'done';

const MOCK_OCR_TEXTS = [
  `CONTRAT DE PRESTATION DE SERVICES\n\nEntre les soussignés:\n- Société ITCOMP SAS, représentée par M. Ahmed Dupont\n- Prestataire: Tech Solutions SARL\n\nObjet: Développement d'une application web\nDurée: 6 mois à compter du 01/06/2025\nMontant: 45,000 EUR HT\n\nSigné le 15 mai 2025`,
  `RAPPORT D'AUDIT INTERNE Q2 2025\n\nDépartement: Finance\nAuditeur: Claire Martin\nDate: 20 avril 2025\n\nConclusions:\n- Conformité réglementaire: 94%\n- Risques identifiés: 3 (niveau moyen)\n- Recommandations: mise à jour des procédures de validation\n\nStatut: Approuvé`,
  `BON DE COMMANDE #BC-2025-0892\n\nFournisseur: Office Pro Distribution\nDate: 03 mai 2025\nRéférence: BC-2025-0892\n\nArticles commandés:\n- 10x Écrans 27 pouces: 4,500 EUR\n- 5x Claviers ergonomiques: 450 EUR\nTotal TTC: 5,940 EUR`,
];

export function ScanDocumentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get('folder');
  const { user } = useAuth();
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [ocrText, setOcrText] = useState('');
  const [docName, setDocName] = useState('');
  const [department, setDepartment] = useState('Général');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleReset = () => {
    setPhase('idle');
    setProgress(0);
    setOcrText('');
    setDocName('');
    setDepartment('Général');
    setSelectedTags([]);
    setIsSubmitting(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
  };

  const handleStartScan = async (file?: File) => {
    if (!file && !selectedFile) return;
    const targetFile = file || selectedFile;
    if (targetFile) {
      setSelectedFile(targetFile);
      const url = URL.createObjectURL(targetFile);
      setPreviewUrl(url);
    }

    setPhase('scanning');
    setProgress(0);

    for (let i = 0; i <= 60; i += 15) {
      await new Promise((r) => setTimeout(r, 150));
      setProgress(i);
    }

    setPhase('processing');

    for (let i = 60; i <= 100; i += 10) {
      await new Promise((r) => setTimeout(r, 100));
      setProgress(Math.min(i, 100));
    }

    const randomText = MOCK_OCR_TEXTS[Math.floor(Math.random() * MOCK_OCR_TEXTS.length)];
    const fileName = targetFile ? targetFile.name.replace(/\.[^.]+$/, '') : 'Document_Scanné';
    
    setOcrText(randomText);
    setDocName(fileName);
    setPhase('done');
  };

  const handleConfirm = async () => {
    if (!docName.trim()) {
      toast.error('Veuillez saisir un nom pour le document.');
      return;
    }

    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 800));
    
    const scanData = {
      name: docName,
      ocrText: ocrText,
      department: department,
      tags: selectedTags,
      originalFile: selectedFile ? { name: selectedFile.name, size: selectedFile.size, type: selectedFile.type } : null,
      timestamp: new Date().toISOString()
    };
    
    sessionStorage.setItem('edms_last_scan', JSON.stringify(scanData));
    toast.success(`Scan "${docName}" prêt pour l'importation`);
    navigate(`/documents/upload?source=scan${folderId ? `&folder=${folderId}` : ''}`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] -m-5 bg-background overflow-hidden border border-border rounded-xl shadow-sm">
      <Helmet>
        <title>Numérisation intelligente — EDMS</title>
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
                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleStartScan(e.target.files[0])} />
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
                                {phase === 'done' ? <CheckCircle2 className="h-12 w-12" /> : <ScanLine className={`h-12 w-12 ${phase !== 'idle' ? 'animate-pulse' : ''}`} />}
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
                            <div className="bg-accent/50 p-6 rounded-2xl border border-border max-w-sm mx-auto text-left space-y-4 animate-in slide-in-from-bottom-4">
                               <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                                  <span>Confidence</span>
                                  <span className="text-emerald-500 font-black">98.4%</span>
                               </div>
                               <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                                  <span>Langue</span>
                                  <span className="text-foreground">Français</span>
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
                  <div className="p-6 space-y-8 animate-in fade-in duration-500">
                     <div className="space-y-6">
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
                              Texte Extrait
                              <span className="text-[9px] text-primary italic font-medium">Auto-généré</span>
                           </label>
                           <textarea 
                             rows={8}
                             value={ocrText}
                             onChange={(e) => setOcrText(e.target.value)}
                             className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-[11px] text-foreground leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                           />
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

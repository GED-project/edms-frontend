import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  X, Download, Trash2, Pencil, Copy, 
  Search, Plus, Minus, Edit3, Image as ImageIcon,
  Crop, Info, History, Menu, Share2, Sliders, PenTool, 
  Eraser, RotateCcw, RotateCw, FileText, ChevronLeft,
  Calendar, User, Tag, Clock, CheckCircle2, XCircle,
  MoreVertical, Printer, Send, ShieldCheck, MessageSquare
} from 'lucide-react';
import { DocumentRow, DocumentVersion } from './page';
import { useAuth } from '@/providers/auth-provider';
import { Role } from '@/lib/auth-rbac/roles';
import { useDebounce } from '@/lib/use-debounce';
import { activityLogger, ActivityEntry } from '@/lib/activity-logger';
import { toast } from 'sonner';

const MOCK_TEXT = `This Project Implementation Agreement ("Agreement") is made and entered into as of [Date], between [Service Provider Name], having its principal place of business at [Address] ("Provider"), and [Client Company Name], having its principal place of business at [Address] ("Client").

Definitions
• "Project" means the development and deployment of the DMS platform.
• "Effective Date" means [the date on which the Project agreement is signed by both parties].
• "Confidential Information" means [definition of what constitutes confidential data].

Scope of Services
The Service Provider shall design, develop, and implement a web-based ERP system for the Client, including
• Requirement gathering and system planning
• Requirement gathering and system planning
• Requirement gathering and system planning
• Requirement gathering and system planning

Term and Termination
Both parties agree to maintain the confidentiality of proprietary information and shall not disclose such information without written consent.`;

export function DocumentViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [doc, setDoc] = useState<DocumentRow | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'metadata' | 'route' | 'history' | 'versions'>('metadata');
  const [searchQuery, setSearchQuery] = useState('Project');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [showFind, setShowFind] = useState(true);
  
  // Load document from local storage
  useEffect(() => {
    const saved = localStorage.getItem('edms_documents_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as DocumentRow[];
        const found = parsed.find(n => n.id === id);
        if (found) {
          setDoc(found);
        } else {
          toast.error("Document non trouvé");
          navigate('/documents');
        }
      } catch (e) {
        navigate('/documents');
      }
    }
  }, [id, navigate]);

  const hasOcr = Boolean((doc?.metadata as any)?.ocrText);
  const [activeViewerTab, setActiveViewerTab] = useState<'original' | 'ocr'>(hasOcr ? 'ocr' : 'original');

  useEffect(() => {
    if (hasOcr) setActiveViewerTab('ocr');
  }, [hasOcr]);

  const viewType = useMemo(() => {
    if (!doc) return 'document';
    const ext = doc.extension?.toLowerCase() || '';
    if (ext === 'pdf') return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    return 'document';
  }, [doc]);

  // Activity history for this specific document
  const docActivity = useMemo(() => {
    if (!doc) return [];
    return activityLogger.getAll().filter(log => log.documentName === doc.name);
  }, [doc]);

  if (!doc) return null;

  const renderHighlightedDocText = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => (
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-[#fef08a] text-gray-900 rounded-sm px-0.5">{part}</mark>
          ) : <span key={i}>{part}</span>
        ))}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] -m-5 bg-background overflow-hidden border border-border rounded-xl shadow-sm">
      <Helmet>
        <title>{doc.name} — EDMS Viewer</title>
      </Helmet>

      {/* Header Toolbar */}
      <div className="h-14 px-6 border-b border-border bg-card flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
            title="Retour"
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded flex items-center justify-center ${
              viewType === 'pdf' ? 'bg-red-500/10 text-red-500' : 
              viewType === 'image' ? 'bg-purple-500/10 text-purple-500' : 
              'bg-blue-500/10 text-blue-500'
            }`}>
              {viewType === 'image' ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground truncate max-w-[300px]">{doc.name}</h1>
              <p className="text-[11px] text-muted-foreground">Version {doc.versions ? doc.versions[0].version : '1.0'}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-accent/50 rounded-lg p-1 mr-4">
            <button className="p-1.5 hover:bg-background rounded-md text-muted-foreground hover:text-foreground transition-all">
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-[11px] font-medium px-2 min-w-[45px] text-center">100%</span>
            <button className="p-1.5 hover:bg-background rounded-md text-muted-foreground hover:text-foreground transition-all">
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Télécharger">
              <Download className="h-4 w-4" />
            </button>
            <button className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Imprimer">
              <Printer className="h-4 w-4" />
            </button>
            <button className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Partager">
              <Share2 className="h-4 w-4" />
            </button>
            <div className="w-px h-6 bg-border mx-1" />
            <button className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Plus d'actions">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content: Viewer */}
        <div className="flex-1 flex flex-col bg-accent/20 overflow-hidden relative">
          
          {/* Viewer Sub-toolbar */}
          <div className="h-12 px-6 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between shrink-0">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setActiveViewerTab('original')}
                className={`text-xs font-semibold relative h-12 transition-colors ${activeViewerTab === 'original' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Document original
                {activeViewerTab === 'original' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />}
              </button>
              {hasOcr && (
                <button 
                  onClick={() => setActiveViewerTab('ocr')}
                  className={`text-xs font-semibold relative h-12 transition-colors ${activeViewerTab === 'ocr' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Contenu extrait (OCR)
                  {activeViewerTab === 'ocr' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />}
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-4">
               <button className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                  <RotateCcw className="h-3.5 w-3.5" /> Rotation L
               </button>
               <button className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                  <RotateCw className="h-3.5 w-3.5" /> Rotation R
               </button>
            </div>
          </div>

          {/* Viewer Area */}
          <div className="flex-1 overflow-y-auto p-10 flex justify-center bg-zinc-100 dark:bg-zinc-900/50">
             {activeViewerTab === 'ocr' ? (
                <div className="w-full max-w-[800px] bg-card p-16 shadow-xl border border-border min-h-[1000px] animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h1 className="text-base font-bold text-center text-foreground mb-12 uppercase tracking-widest border-b border-border pb-8">
                    Contenu Extrait (OCR)
                  </h1>
                  <div className="prose prose-zinc dark:prose-invert max-w-none text-muted-foreground leading-loose font-mono text-sm">
                    {renderHighlightedDocText(MOCK_TEXT, debouncedSearch)}
                  </div>
                </div>
             ) : viewType === 'pdf' ? (
                <div className="w-full max-w-[850px] bg-white dark:bg-zinc-800 p-16 shadow-2xl border border-border min-h-[1100px] relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Mock PDF Content */}
                  <div className="flex items-center justify-between border-b-2 border-primary/20 pb-8 mb-12">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-xl italic shadow-lg shadow-primary/20">IT</div>
                        <div>
                          <h2 className="text-xl font-black text-foreground tracking-tight italic uppercase">ITCOMP EDMS</h2>
                          <p className="text-[10px] text-muted-foreground font-bold tracking-[0.2em] uppercase">Solutions Numériques</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Invoice / Report</p>
                        <p className="text-lg font-bold text-foreground">#EDMS-2025-042</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-12 mb-16">
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">From</p>
                        <p className="text-sm font-bold text-foreground">James Doe</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">Chief Director<br/>45-1, Anson Road Singapore - 8989</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Contact</p>
                        <p className="text-[11px] text-muted-foreground">james@dreamstudio.com<br/>+880 1234 567 89</p>
                      </div>
                    </div>
                    <div className="text-right space-y-4">
                       <div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Issue Date</p>
                        <p className="text-sm font-bold text-foreground">10 September, 2025</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8 text-sm text-foreground/80 leading-relaxed text-justify mb-20">
                    <p>
                      This project implementation document outlines the strategic deployment of the Enterprise Document Management System (EDMS). 
                      The objective is to provide a comprehensive framework for digitizing corporate records and optimizing cross-departmental workflows.
                    </p>
                    <p>
                      The architecture leverages a hybrid cloud approach, ensuring both high availability and strict data residency compliance. 
                      Encryption protocols at rest and in transit are implemented to safeguard sensitive intellectual property.
                    </p>
                    <p>
                      Phase 1 focuses on the migration of legacy archives from the HR and Finance departments. 
                      Automated classification via AI-driven OCR allows for instantaneous indexing and searchability.
                    </p>
                  </div>

                  <div className="flex justify-end pt-20">
                    <div className="text-center w-48">
                       <div className="h-1 bg-border w-full mb-2" />
                       <p className="text-[11px] font-serif italic text-muted-foreground">Authorized Signature</p>
                       <p className="text-[10px] font-bold text-foreground uppercase mt-1 tracking-widest">Global Operations</p>
                    </div>
                  </div>
                  
                  {/* Decorative element */}
                  <div className="absolute bottom-0 left-0 w-full h-2 bg-primary/30" />
                </div>
             ) : viewType === 'image' ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in duration-500">
                  <div className="relative border-4 border-primary rounded-xl overflow-hidden shadow-2xl bg-card">
                    <img 
                      src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=1200" 
                      alt={doc.name} 
                      className="max-w-full max-h-[70vh] object-contain block" 
                    />
                    <div className="absolute inset-0 pointer-events-none border border-white/20 rounded-lg" />
                  </div>
                  
                  <div className="mt-12 flex flex-col items-center w-full max-w-md">
                    <span className="text-xs font-bold text-foreground mb-4 bg-accent px-3 py-1 rounded-full shadow-sm">0° Rotation</span>
                    <div className="w-full flex items-center justify-between px-2">
                      {[...Array(21)].map((_, i) => (
                        <div key={i} className={`rounded-full transition-colors ${i === 10 ? 'h-4 w-1 bg-primary' : 'w-1 h-1 bg-muted-foreground/30'}`} />
                      ))}
                    </div>
                    <div className="flex items-center gap-6 mt-8">
                      <button className="p-3 bg-card border border-border rounded-full text-muted-foreground hover:text-primary hover:border-primary/50 transition-all shadow-sm">
                        <RotateCcw className="h-5 w-5" />
                      </button>
                      <button className="p-3 bg-card border border-border rounded-full text-muted-foreground hover:text-primary hover:border-primary/50 transition-all shadow-sm">
                        <RotateCw className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
             ) : (
                <div className="w-full max-w-[800px] bg-card p-16 shadow-xl border border-border min-h-[1000px] animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h1 className="text-lg font-bold text-center text-foreground mb-12 uppercase tracking-widest">
                    {doc.name}
                  </h1>
                  <div className="prose prose-zinc dark:prose-invert max-w-none text-foreground/80 leading-loose">
                    {renderHighlightedDocText(MOCK_TEXT, debouncedSearch)}
                  </div>
                </div>
             )}
          </div>
        </div>

        {/* Right Sidebar: Metadata / Route / History */}
        <div className="w-[400px] border-l border-border bg-card flex flex-col shrink-0 z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
          {/* Tabs */}
          <div className="flex border-b border-border p-1 bg-accent/30 m-3 rounded-lg shrink-0">
             <button 
                onClick={() => setActiveSidebarTab('metadata')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${activeSidebarTab === 'metadata' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
             >
                <Info className="h-3.5 w-3.5" />
                Fiche
             </button>
             <button 
                onClick={() => setActiveSidebarTab('route')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${activeSidebarTab === 'route' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
             >
                <Send className="h-3.5 w-3.5" />
                Parcours
             </button>
             <button 
                onClick={() => setActiveSidebarTab('versions')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${activeSidebarTab === 'versions' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
             >
                <Clock className="h-3.5 w-3.5" />
                Versions
             </button>
             <button 
                onClick={() => setActiveSidebarTab('history')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${activeSidebarTab === 'history' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
             >
                <History className="h-3.5 w-3.5" />
                Historique
             </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
             {activeSidebarTab === 'metadata' && (
                <div className="p-6 space-y-8 animate-in fade-in duration-300">
                  {/* Status & Quick Actions */}
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-xs font-bold text-foreground uppercase tracking-wider">En attente</span>
                     </div>
                     <div className="flex gap-1.5">
                        <button 
                          onClick={() => {
                            activityLogger.log('approve', doc.name, user?.fullName ?? 'Utilisateur', 'Visé via la vue détaillée');
                            toast.success("Document visé");
                          }}
                          className="px-3 py-1.5 bg-primary/10 text-primary text-[11px] font-bold rounded-lg hover:bg-primary/20 transition-colors"
                        >
                           Viser
                        </button>
                        <button 
                          onClick={() => {
                            activityLogger.log('reject', doc.name, user?.fullName ?? 'Utilisateur', 'Rejeté via la vue détaillée');
                            toast.error("Document rejeté");
                          }}
                          className="px-3 py-1.5 bg-red-500/10 text-red-500 text-[11px] font-bold rounded-lg hover:bg-red-500/20 transition-colors"
                        >
                           Rejeter
                        </button>
                     </div>
                  </div>

                  {/* Form fields */}
                  <div className="grid gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nom du document</label>
                      <input 
                        type="text" 
                        value={doc.name} 
                        readOnly 
                        className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Auteur</label>
                        <div className="flex items-center gap-2 bg-accent/30 border border-border rounded-lg px-3 py-2">
                           <User className="h-3.5 w-3.5 text-muted-foreground" />
                           <span className="text-sm text-foreground truncate">{doc.author || 'N/A'}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Date de création</label>
                        <div className="flex items-center gap-2 bg-accent/30 border border-border rounded-lg px-3 py-2">
                           <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                           <span className="text-sm text-foreground">{doc.date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Index</label>
                        <input 
                          type="text" 
                          value={doc.id.toUpperCase()} 
                          readOnly 
                          className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Type</label>
                        <input 
                          type="text" 
                          value={doc.type.toUpperCase()} 
                          readOnly 
                          className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Description</label>
                      <textarea 
                        rows={3}
                        value="Ce document fait partie du dossier de projet 2025. Il contient les clauses techniques et les accords de niveau de service."
                        readOnly
                        className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Étiquettes / Tags</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(doc.tags || ['Stratégie', 'Confidentiel', '2025']).map(tag => (
                          <span key={tag} className="px-2.5 py-1 rounded-md bg-primary/5 border border-primary/10 text-primary text-[10px] font-semibold">
                            {tag}
                          </span>
                        ))}
                        <button className="w-6 h-6 rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Security Info */}
                  <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                       <ShieldCheck className="h-4 w-4" />
                       <span className="text-xs font-bold uppercase tracking-wider">Sécurité & Accès</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                       Ce document est classé <strong>Interne</strong>. Seuls les membres du département Finance et la Direction peuvent y accéder.
                    </p>
                  </div>
                </div>
             )}

             {activeSidebarTab === 'route' && (
                <div className="p-6 space-y-8 animate-in fade-in duration-300">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                       <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Circuit de validation</h3>
                       <span className="px-2 py-0.5 bg-teal-500/10 text-teal-500 text-[10px] font-bold rounded">En cours</span>
                    </div>

                    <div className="relative pl-6 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                       <div className="relative">
                          <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card z-10" />
                          <div className="flex items-start justify-between">
                             <div>
                                <p className="text-xs font-bold text-foreground">Initiateur</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Sara Andrews (RH)</p>
                             </div>
                             <span className="text-[10px] text-emerald-500 font-bold uppercase">Complété</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">28/07/2025 15:10</p>
                       </div>

                       <div className="relative">
                          <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card z-10" />
                          <div className="flex items-start justify-between">
                             <div>
                                <p className="text-xs font-bold text-foreground">Vérification RH</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Jean Dupont</p>
                             </div>
                             <span className="text-[10px] text-emerald-500 font-bold uppercase">Complété</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">29/07/2025 09:30</p>
                       </div>

                       <div className="relative">
                          <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-card z-10 animate-pulse" />
                          <div className="flex items-start justify-between">
                             <div>
                                <p className="text-xs font-bold text-foreground">Approbation Direction</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Marc Lefebvre</p>
                             </div>
                             <span className="text-[10px] text-amber-500 font-bold uppercase">En cours</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">Assigné le 29/07/2025</p>
                       </div>

                       <div className="relative opacity-40">
                          <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-border border-2 border-card z-10" />
                          <div>
                             <p className="text-xs font-bold text-foreground">Archivage Système</p>
                             <p className="text-[11px] text-muted-foreground mt-0.5">Automatique</p>
                          </div>
                       </div>
                    </div>

                    <button className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
                       <MessageSquare className="h-3.5 w-3.5" />
                       Ajouter un commentaire au circuit
                    </button>
                  </div>
                </div>
             )}

             {activeSidebarTab === 'versions' && (
                <div className="p-6 space-y-6 animate-in fade-in duration-300">
                   <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Versions du document</h3>
                      <span className="text-[10px] font-bold text-muted-foreground bg-accent/50 px-2 py-0.5 rounded">
                        {(doc.versions || []).length} versions
                      </span>
                   </div>

                   <div className="space-y-4">
                      {(doc.versions || []).map((v, i) => (
                         <div key={v.id} className={`p-4 rounded-2xl border transition-all ${i === 0 ? 'border-primary/30 bg-primary/5 shadow-sm' : 'border-border bg-accent/5 hover:bg-accent/10'}`}>
                            <div className="flex items-center justify-between mb-3">
                               <div className="flex items-center gap-2">
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-primary text-white' : 'bg-accent text-muted-foreground'}`}>
                                     v{v.version}
                                  </div>
                                  <div>
                                     <p className="text-[11px] font-bold text-foreground">Version {v.version}</p>
                                     <p className="text-[9px] text-muted-foreground">{new Date(v.date).toLocaleDateString()} {new Date(v.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                  </div>
                               </div>
                               {i === 0 && (
                                  <span className="text-[8px] font-black uppercase tracking-tighter bg-emerald-500 text-white px-1.5 py-0.5 rounded">Actuelle</span>
                               )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                               <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <User className="h-3 w-3" /> {v.author}
                               </div>
                               <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <FileText className="h-3 w-3" /> {v.size}
                               </div>
                            </div>
                            {i > 0 && (
                               <button 
                                 onClick={() => toast.info(`Restauration de la version ${v.version} (simulation)`)}
                                 className="w-full mt-3 py-1.5 text-[10px] font-bold text-primary border border-primary/20 rounded-lg hover:bg-primary/5 transition-all"
                               >
                                  Restaurer cette version
                               </button>
                            )}
                         </div>
                      ))}
                   </div>

                   <div className="pt-4">
                      <button 
                        onClick={() => navigate(`/documents/upload?replace=${doc.id}`)}
                        className="w-full py-3 bg-accent hover:bg-accent/80 border border-border text-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                         <Plus className="h-3.5 w-3.5" /> Nouvelle version
                      </button>
                   </div>
                </div>
              )}

             {activeSidebarTab === 'history' && (
                <div className="p-0 animate-in fade-in duration-300">
                  <div className="p-4 border-b border-border bg-accent/10 flex items-center justify-between">
                     <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Journal des actions</h3>
                     <span className="text-[10px] text-muted-foreground">{docActivity.length} entrées</span>
                  </div>
                  <div className="divide-y divide-border/50">
                    {docActivity.length === 0 ? (
                      <div className="p-12 text-center">
                        <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-xs text-muted-foreground">Aucun historique disponible pour ce document.</p>
                      </div>
                    ) : (
                      docActivity.map((log) => (
                        <div key={log.id} className="p-4 hover:bg-accent/20 transition-colors">
                           <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-muted-foreground shrink-0">
                                 {log.action === 'approve' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : 
                                  log.action === 'reject' ? <XCircle className="h-3.5 w-3.5 text-red-500" /> : 
                                  log.action === 'upload' ? <Plus className="h-3.5 w-3.5 text-blue-500" /> :
                                  <Clock className="h-3.5 w-3.5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <p className="text-xs font-bold text-foreground truncate">
                                    {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                                 </p>
                                 <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {log.user} • {new Date(log.date).toLocaleDateString()}
                                 </p>
                                 {log.details && (
                                    <p className="text-[10px] bg-accent/40 rounded px-1.5 py-0.5 mt-2 text-muted-foreground inline-block">
                                       {log.details}
                                    </p>
                                 )}
                              </div>
                           </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
             )}
          </div>

          {/* Footer Controls */}
          <div className="p-4 border-t border-border bg-card shrink-0">
             <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => {
                    activityLogger.log('approve', doc.name, user?.fullName ?? 'Utilisateur', 'Approuvé via la vue détaillée');
                    toast.success("Document approuvé avec succès");
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/10 transition-all"
                >
                   <CheckCircle2 className="h-4 w-4" />
                   Enregistrer
                </button>
                <button 
                  onClick={() => {
                    activityLogger.log('reject', doc.name, user?.fullName ?? 'Utilisateur', 'Rejeté via la vue détaillée');
                    toast.error("Document rejeté");
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 border border-border bg-card hover:bg-accent text-foreground text-xs font-bold rounded-xl transition-all"
                >
                   <XCircle className="h-4 w-4" />
                   Rejeter
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

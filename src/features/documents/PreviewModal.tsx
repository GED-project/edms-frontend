import { useState, useEffect } from 'react';
import { 
  X, Download, Trash2, Pencil, Copy, 
  Search, Plus, Minus, Edit3, Image as ImageIcon,
  Crop, Info, History, Menu, Share2, Sliders, PenTool, Eraser, RotateCcw, RotateCw, FileText
} from 'lucide-react';
import { DocumentRow } from './page';
import { useAuth } from '@/providers/auth-provider';
import { Role } from '@/lib/auth-rbac/roles';
import { useDebounce } from '@/lib/use-debounce';

export interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentRow | null;
  onApprove?: (doc: DocumentRow) => void;
  onDuplicate?: (doc: DocumentRow) => void;
  onRename?: (doc: DocumentRow) => void;
  onDelete?: (doc: DocumentRow) => void;
  onDownload?: (doc: DocumentRow) => void;
  onOpenEditor?: (doc: DocumentRow) => void;
}

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

export function PreviewModal({ 
  isOpen, onClose, document: doc,
  onApprove, onDuplicate, onRename, onDelete, onDownload, onOpenEditor
}: PreviewModalProps) {
  const { user } = useAuth();
  const canApprove = user?.role === Role.ADMIN || user?.role === Role.MANAGER;

  const [searchQuery, setSearchQuery] = useState('Project');
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  const [showFind, setShowFind] = useState(true);
  const hasOcr = Boolean((doc?.metadata as any)?.ocrText);
  const [activeTab, setActiveTab] = useState<'original' | 'ocr'>(hasOcr ? 'ocr' : 'original');

  const viewType = (() => {
    if (!doc) return 'document';
    const ext = doc.extension?.toLowerCase() || '';
    if (ext === 'pdf') return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    return 'document';
  })();

  useEffect(() => {
    setActiveTab(hasOcr ? 'ocr' : 'original');
  }, [hasOcr, doc]);

  // Keyboard escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.document.addEventListener('keydown', handleEsc);
    return () => window.document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !doc) return null;

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

  const renderHighlightedSnippet = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={i} className="font-semibold text-gray-900">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  const occurrences = [
    "Projects Implementation",
    "\"Project\" Means the development and dep",
    "Project agreement is signed by both parties",
    "Scope of Project"
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-[2px] p-4 sm:p-8 animate-in fade-in duration-200">
      {/* Centered Modal Content */}
      <div className="w-full max-w-[1280px] h-[92vh] bg-white rounded-xl shadow-2xl flex overflow-hidden relative animate-in zoom-in-95 duration-200">
        
        {viewType === 'image' && (
          <div className="w-full h-full flex flex-col bg-gray-50/50">
            {/* Header */}
            <div className="h-16 px-6 bg-white border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center">
                  <ImageIcon className="h-4 w-4 text-blue-500" />
                </div>
                <span className="text-[14px] font-semibold text-gray-800">{doc?.name}</span>
              </div>
              
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-4 text-gray-400">
                  <Download className="h-[18px] w-[18px] hover:text-gray-700 cursor-pointer" strokeWidth={1.5} onClick={() => onDownload?.(doc as any)} />
                  <Crop className="h-[18px] w-[18px] text-gray-700 cursor-pointer" strokeWidth={1.5} />
                  <Trash2 className="h-[18px] w-[18px] hover:text-red-500 cursor-pointer" strokeWidth={1.5} onClick={() => onDelete?.(doc as any)} />
                  <Info className="h-[18px] w-[18px] hover:text-gray-700 cursor-pointer" strokeWidth={1.5} />
                </div>
                <div className="w-px h-6 bg-gray-200" />
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-gray-600">Editor Mode</span>
                  <div className="w-8 h-5 rounded-full bg-[#38a3a5] relative flex items-center px-0.5 cursor-pointer">
                      <div className="w-4 h-4 rounded-full bg-white absolute right-0.5 shadow-sm" />
                  </div>
                </div>
                <div className="w-px h-6 bg-gray-200" />
                <div className="flex items-center gap-4 text-gray-400">
                  <Info className="h-[18px] w-[18px] hover:text-gray-700 cursor-pointer" strokeWidth={1.5} />
                  <History className="h-[18px] w-[18px] hover:text-gray-700 cursor-pointer" strokeWidth={1.5} />
                  <Menu className="h-[18px] w-[18px] hover:text-gray-700 cursor-pointer" strokeWidth={1.5} />
                </div>
                
                <button className="px-4 py-2 bg-[#38a3a5] text-white text-[13px] font-semibold rounded-lg flex items-center gap-2 ml-2 hover:bg-[#2d8587] transition-colors">
                  <Share2 className="h-4 w-4" /> Share
                </button>
                <button onClick={onClose} className="ml-4 p-1 text-gray-400 hover:text-gray-700">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Sub Toolbar */}
            <div className="flex items-center justify-center gap-8 py-3 bg-white border-b border-gray-100 shrink-0 text-[13px] font-semibold">
              <button className="flex items-center gap-2 text-[#38a3a5]">
                <Crop className="h-4 w-4" /> Crop
              </button>
              <button className="flex items-center gap-2 text-gray-500 hover:text-gray-800">
                <Sliders className="h-4 w-4" /> Adjustment
              </button>
              <button className="flex items-center gap-2 text-gray-500 hover:text-gray-800">
                <PenTool className="h-4 w-4" /> Highlighter
              </button>
              <button className="flex items-center gap-2 text-gray-500 hover:text-gray-800">
                <Eraser className="h-4 w-4" /> Eraser
              </button>
            </div>
            
            {/* Image Area */}
            <div className="flex-1 overflow-hidden flex flex-col items-center justify-center p-8">
              <div className="relative border-[3px] border-[#38a3a5] inline-block shadow-lg bg-white p-1">
                <img src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=800&h=500" alt="Mock" className="max-w-[700px] object-cover block" />
                <div className="absolute top-[-6px] left-[-6px] w-4 h-4 border-l-4 border-t-4 border-[#38a3a5]" />
                <div className="absolute top-[-6px] right-[-6px] w-4 h-4 border-r-4 border-t-4 border-[#38a3a5]" />
                <div className="absolute bottom-[-6px] left-[-6px] w-4 h-4 border-l-4 border-b-4 border-[#38a3a5]" />
                <div className="absolute bottom-[-6px] right-[-6px] w-4 h-4 border-r-4 border-b-4 border-[#38a3a5]" />
              </div>
              
              <div className="mt-8 flex flex-col items-center w-full max-w-[400px]">
                <span className="text-[14px] font-semibold text-gray-800 mb-2">0°</span>
                <div className="w-full flex items-center justify-between text-gray-300">
                  {[...Array(21)].map((_, i) => (
                    <div key={i} className={`rounded-full bg-gray-300 ${i === 10 ? 'h-3 w-1 rounded-sm bg-gray-500' : 'w-1 h-1'}`} />
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-4 text-gray-400">
                  <RotateCcw className="h-5 w-5 hover:text-gray-600 cursor-pointer" />
                  <RotateCw className="h-5 w-5 hover:text-gray-600 cursor-pointer" />
                </div>
              </div>
            </div>
          </div>
        )}

        {(viewType === 'document' || viewType === 'pdf') && (
          <>
            {/* === LEFT SIDE: PREVIEW & SEARCH === */}
            <div className="flex-[2] flex flex-col bg-white">
              
              {/* Top Toolbar */}
              <div className="h-14 flex items-center justify-between px-4 shrink-0">
                <div className="w-[280px] flex items-center">
                  {viewType === 'document' && (
                    <button 
                      onClick={() => setShowFind(!showFind)}
                      className="w-8 h-8 flex items-center justify-center bg-teal-50 text-teal-500 rounded-lg"
                    >
                      <Search className="h-4 w-4" />
                    </button>
                  )}
                </div>
                
                <div className="text-xs text-gray-800 font-medium flex-1 text-center pr-[280px] flex items-center justify-center gap-2">
                  <span className="font-bold">39</span> <span className="text-gray-400 font-normal">of 50</span>
                </div>
                
                <div className="flex items-center gap-1.5 text-gray-400 absolute right-[360px] top-4">
                  <button className="p-1 hover:text-gray-600"><Plus className="h-4 w-4" /></button>
                  <button className="p-1 hover:text-gray-600"><Minus className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="flex-1 flex overflow-hidden relative border-t border-gray-100">
                {/* Find Panel (Only for Document) */}
                {viewType === 'document' && showFind && (
                  <div className="w-[280px] bg-white border-r border-gray-100 flex flex-col shrink-0">
                    <div className="p-5 pb-2">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-900">Find</h3>
                        <button onClick={() => setShowFind(false)} className="text-gray-400 hover:text-gray-600">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      
                      <div className="relative flex items-center">
                        <Search className="absolute left-3 h-3.5 w-3.5 text-gray-400" />
                        <input 
                          type="text"
                          placeholder="Search document..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-4 py-1.5 text-[13px] border border-gray-200 rounded-md bg-white focus:outline-none focus:border-gray-300 transition-all text-gray-700 shadow-sm"
                        />
                      </div>
                      
                      <p className="text-[11px] text-gray-500 mt-6 font-semibold">
                        20 matches in 50 pages
                      </p>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5 mt-4">
                      {occurrences.map((occ, i) => (
                        <div key={i} className="text-[12px] text-gray-500 leading-relaxed cursor-pointer hover:text-gray-800 transition-colors pr-2">
                          {renderHighlightedSnippet(occ, debouncedSearch)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Document Viewer Area */}
                <div className="flex-1 flex flex-col bg-gray-50">
                  {/* Document Tabs */}
                  <div className="flex items-center gap-6 px-6 py-3 border-b border-gray-200 bg-white shadow-sm shrink-0">
                    <button 
                      onClick={() => setActiveTab('original')}
                      className={`text-[13px] font-semibold transition-colors relative pb-1 ${activeTab === 'original' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      Document original
                      {activeTab === 'original' && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#38a3a5] rounded-full" />}
                    </button>
                    {hasOcr && (
                      <button 
                        onClick={() => setActiveTab('ocr')}
                        className={`text-[13px] font-semibold transition-colors relative pb-1 ${activeTab === 'ocr' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        Contenu extrait (OCR)
                        {activeTab === 'ocr' && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#38a3a5] rounded-full" />}
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-12 flex justify-center items-start">
                    {activeTab === 'ocr' ? (
                      <div className="w-full max-w-[550px] bg-white p-12 shadow-sm min-h-[800px] border border-gray-200/50">
                        <h1 className="text-[15px] font-bold text-center text-gray-800 mb-8 uppercase tracking-wide">
                          Contenu OCR Brut
                        </h1>
                        <div className="prose prose-sm prose-gray max-w-none text-gray-600 leading-[1.8] font-mono text-[13px]">
                          {renderHighlightedDocText(MOCK_TEXT, debouncedSearch)}
                        </div>
                      </div>
                    ) : viewType === 'pdf' ? (
                      <div className="w-full max-w-[650px] bg-white p-12 shadow-sm min-h-[850px] border border-gray-200/50 relative">
                        {/* Mock PDF Header */}
                        <div className="flex items-center justify-center gap-3 border-b border-red-500 pb-4 mb-10">
                          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-red-100">
                             <div className="w-4 h-4 bg-red-500 rounded-sm" />
                          </div>
                          <h1 className="text-[18px] font-bold text-gray-800 uppercase tracking-widest">
                            Dream Studio
                          </h1>
                        </div>
                        
                        <div className="flex justify-between items-start mb-12 text-[11px] text-gray-500">
                          <div>
                            <p className="text-red-500 font-bold mb-1">James Doe</p>
                            <p>Chief Director</p>
                            <p>A : 45-1, Anson Road Singapore - 8989</p>
                            <p>W : email@mail.com, www.myweb.com</p>
                            <p>P : +880 - 12345 - 6789</p>
                          </div>
                          <div className="text-right mt-12">
                            <p>Date, 10 September, 2019</p>
                          </div>
                        </div>

                        <div className="prose prose-sm prose-gray max-w-none text-gray-600 leading-[2.2] text-[12px] text-justify space-y-6">
                          <p>
                            This is a sample letter that has been placed to demonstrate typing remat (Your Company) letterhead design. When positioned properly, it will serve to work in harmony with all other elements letterhead. This letterhead design is meant to project an image.
                          </p>
                          <p>
                            This letterhead design is meant project an image of professionalism reliability. By using simple align we have created a very spacious feeling. The simplicity suggest rength the spaciousnes contributes h aesthetics the layout. These basic qualities along with the (Your Company).
                          </p>
                          <p>
                            look and helps reinforce the (Your Company) brand. letterhead design is meant to project an image p design. When positioned properly, it will serve to work in harmony all the other elements letterhead. sionalism and reliability.
                          </p>
                        </div>
                        
                        <div className="mt-16">
                          <div className="w-32 border-b border-gray-300 mb-2"></div>
                          <p className="text-[11px] text-gray-500 italic font-serif">John Smeeth</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Manager</p>
                        </div>
                        
                        {/* Mock PDF Footer */}
                        <div className="absolute bottom-0 left-0 w-full h-12 bg-red-600" />
                      </div>
                    ) : (
                      <div className="w-full max-w-[550px] bg-white p-12 shadow-sm min-h-[800px] border border-gray-200/50">
                        <h1 className="text-[15px] font-bold text-center text-gray-800 mb-8 uppercase tracking-wide">
                          Project Implementation Agreement
                        </h1>
                        <div className="prose prose-sm prose-gray max-w-none text-gray-600 leading-[1.8]">
                          {renderHighlightedDocText(MOCK_TEXT, debouncedSearch)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* === RIGHT SIDE: METADATA & ACTIONS === */}
            <div className="w-[340px] bg-white flex flex-col shrink-0 shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-10 relative">
              <button 
                onClick={onClose} 
                className="absolute top-4 right-4 z-50 p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex-1 overflow-y-auto p-6 pt-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-start gap-3">
                    {viewType === 'pdf' ? (
                      <div className="mt-0.5 w-8 h-8 rounded shrink-0 bg-red-600 text-white flex items-center justify-center">
                        <FileText className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="mt-0.5 w-8 h-8 rounded shrink-0 bg-[#2b579a] text-white flex items-center justify-center">
                        <span className="text-lg font-bold font-serif leading-none">W</span>
                      </div>
                    )}
                    <div>
                      <h2 className="text-[14px] font-semibold text-gray-900 leading-tight pr-4">{doc?.name}</h2>
                      <p className="text-[11px] text-gray-400 mt-0.5">3.25 MB</p>
                    </div>
                  </div>
                  
                  <div className="mr-4">
                    {canApprove ? (
                      <button 
                        onClick={() => onApprove?.(doc as any)}
                        className="bg-[#fef3c7] text-[#b45309] text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-colors hover:bg-amber-200"
                      >
                        <span className="w-1.5 h-1.5 bg-[#f59e0b] rounded-full animate-pulse" />
                        Pending
                      </button>
                    ) : (
                      <div className="bg-[#fef3c7] text-[#b45309] text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-[#f59e0b] rounded-full" />
                        Pending
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Toolbar */}
                <div className="flex items-center justify-between px-2 mb-6">
                  <button onClick={() => onDuplicate?.(doc as any)} className="flex flex-col items-center gap-2 group">
                    <div className="h-9 w-9 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                      <Copy className="h-[15px] w-[15px] text-gray-500" strokeWidth={1.5} />
                    </div>
                    <span className="text-[9px] text-gray-500 font-medium">Duplicate</span>
                  </button>
                  <button onClick={() => onDownload?.(doc as any)} className="flex flex-col items-center gap-2 group">
                    <div className="h-9 w-9 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                      <Download className="h-[15px] w-[15px] text-gray-500" strokeWidth={1.5} />
                    </div>
                    <span className="text-[9px] text-gray-500 font-medium">Download</span>
                  </button>
                  <button onClick={() => onRename?.(doc as any)} className="flex flex-col items-center gap-2 group">
                    <div className="h-9 w-9 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                      <Pencil className="h-[15px] w-[15px] text-gray-500" strokeWidth={1.5} />
                    </div>
                    <span className="text-[9px] text-gray-500 font-medium">Rename</span>
                  </button>
                  <button onClick={() => onDelete?.(doc as any)} className="flex flex-col items-center gap-2 group">
                    <div className="h-9 w-9 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-red-50 transition-colors">
                      <Trash2 className="h-[15px] w-[15px] text-gray-500 group-hover:text-red-500" strokeWidth={1.5} />
                    </div>
                    <span className="text-[9px] text-gray-500 font-medium">Delete</span>
                  </button>
                </div>

                {/* Sections */}
                <div className="space-y-5">
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1.5">Created By</p>
                    <div className="flex items-center gap-2">
                      <img src="https://i.pravatar.cc/100?img=5" alt="Sara Andrews" className="h-7 w-7 rounded-full" />
                      <span className="text-[12px] text-gray-800 font-semibold">Sara Andrews</span>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1.5">Shared with</p>
                    <div className="flex items-center gap-1.5">
                      <div className="h-6 w-6 rounded-full bg-pink-50 text-pink-500 flex items-center justify-center text-[8px] font-bold">MA</div>
                      <div className="h-6 w-6 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-[8px] font-bold">FD</div>
                      <div className="h-6 w-6 rounded-full bg-cyan-50 text-cyan-500 flex items-center justify-center text-[8px] font-bold">TF</div>
                      <div className="h-6 w-6 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-[8px] font-bold">RF</div>
                      <div className="h-6 w-6 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center text-[8px] font-bold">TH</div>
                      <div className="h-6 w-6 rounded-full bg-[#38a3a5] text-white flex items-center justify-center text-[8px] font-bold">+5</div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1.5">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full bg-gray-50 text-gray-600 text-[10px] font-medium border border-gray-200">Marketing</span>
                      <span className="px-3 py-1 rounded-full bg-gray-50 text-gray-600 text-[10px] font-medium border border-gray-200">Strategy</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold mb-0.5">File Source</p>
                      <p className="text-[12px] text-gray-800 font-medium">Upload</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold mb-0.5">Visibility</p>
                      <p className="text-[12px] text-gray-800 font-medium">Internal</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold mb-0.5">Permanent Link</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-[#38a3a5] hover:underline cursor-pointer truncate max-w-[200px]">
                        https://share.Glidix.com/alphainitiative-v2-updated
                      </span>
                      <Copy className="h-3 w-3 text-[#38a3a5]" />
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold mb-0.5">Document Created</p>
                      <p className="text-[12px] text-gray-800 font-medium">28 July, 2025 @ 3:10 PM</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold mb-0.5">Last Edited</p>
                      <p className="text-[12px] text-gray-800 font-medium">28 July, 2025 @ 3:10 PM</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold mb-0.5">Expiry Date</p>
                      <p className="text-[12px] text-gray-800 font-medium">30 July, 2025</p>
                    </div>
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="mt-6">
                  <button onClick={() => onOpenEditor?.(doc as any)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#38a3a5] hover:bg-[#2d8587] text-white text-[13px] font-semibold rounded-lg transition-colors shadow-sm">
                    <Edit3 className="h-4 w-4" />
                    Open Editor Mode
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

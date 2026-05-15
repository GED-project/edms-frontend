import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, FileText, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { Permission } from '@/lib/auth-rbac/roles';
import { approveDocument } from './document.service';
import { useDocuments } from './useDocuments';

export function ApprovalsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');

  const canApprove = hasPermission(Permission.APPROVE_DOCUMENT);

  const { documents, totalCount, isLoading, error, refetch } = useDocuments({
    reviewOnly: true,
    searchQuery: search,
    maxResultCount: 50,
    sorting: 'creationTime desc',
  });

  const handleApprove = async (docId: string, docTitle: string) => {
    try {
      await approveDocument(docId);
      toast.success(`"${docTitle}" approved`);
      await refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Approval failed');
    }
  };

  return (
    <>
      <Helmet>
        <title>Pending Approvals - ItDoc</title>
      </Helmet>

      <div className="space-y-5 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pending Approvals</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? 'Loading...' : `${totalCount} document(s) awaiting approval`}
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search pending documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : documents.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-2xl bg-card">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No pending approvals</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Documents waiting for approval will appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Document</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Submitted</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/documents/${doc.id}?approve=1`, { state: { doc } })}
                        className="font-medium text-foreground hover:text-primary hover:underline truncate max-w-[300px] block text-left"
                      >
                        {doc.title}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {new Date(doc.creationTime).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/documents/${doc.id}?approve=1`, { state: { doc } })}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Open
                        </button>
                        {canApprove && (
                          <button
                            onClick={() => handleApprove(doc.id, doc.title)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

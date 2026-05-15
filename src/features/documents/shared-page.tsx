import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, Eye } from 'lucide-react';
import { useState } from 'react';
import { useDocuments } from './useDocuments';

export function SharedDocumentsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { documents, totalCount, isLoading, error } = useDocuments({
    sharedOnly: true,
    searchQuery: search,
    maxResultCount: 50,
    sorting: 'creationTime desc',
  });

  return (
    <>
      <Helmet>
        <title>Shared with Me - ItDoc</title>
      </Helmet>

      <div className="space-y-5 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Shared with Me</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? 'Loading...' : `${totalCount} shared document(s)`}
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search shared documents..."
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
            <h3 className="text-base font-semibold text-foreground">No shared documents yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Documents that others share with you will appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Document</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Shared at</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <button
                            onClick={() => navigate(`/documents/${doc.id}`, { state: { doc } })}
                            className="font-medium text-foreground hover:text-primary hover:underline truncate max-w-[240px] block text-left"
                          >
                            {doc.title}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {new Date(doc.creationTime).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/documents/${doc.id}`, { state: { doc } })}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        title="Open"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
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

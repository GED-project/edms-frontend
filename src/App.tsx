import { ThemeProvider } from 'next-themes';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AppRouter } from '@/providers/app-router';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { SignalRProvider } from '@/providers/signalr-provider';
import { ScanProvider } from '@/features/documents/scan-context';

/** Inner wrapper so SignalRProvider can read auth state from context. */
function AppWithRealtime() {
  const { user } = useAuth();
  return (
    <ScanProvider>
      <SignalRProvider enabled={!!user}>
        <Toaster />
        <AppRouter />
      </SignalRProvider>
    </ScanProvider>
  );
}

export function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      storageKey="edms-theme"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      <HelmetProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppWithRealtime />
          </AuthProvider>
        </BrowserRouter>
      </HelmetProvider>
    </ThemeProvider>
  );
}

import { ThemeProvider } from 'next-themes';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AppRouter } from '@/providers/app-router';
import { AuthProvider } from '@/providers/auth-provider';

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
            <Toaster />
            <AppRouter />
          </AuthProvider>
        </BrowserRouter>
      </HelmetProvider>
    </ThemeProvider>
  );
}

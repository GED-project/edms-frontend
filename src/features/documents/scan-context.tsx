import { createContext, useContext, useState, ReactNode } from 'react';

interface ScanContextType {
  scannedImages: File[];
  setScanImages: (files: File[]) => void;
  clearScanImages: () => void;
}

const ScanContext = createContext<ScanContextType | undefined>(undefined);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [scannedImages, setScannedImages] = useState<File[]>([]);

  const setScanImages = (files: File[]) => {
    setScannedImages(files);
  };

  const clearScanImages = () => {
    setScannedImages([]);
  };

  return (
    <ScanContext.Provider value={{ scannedImages, setScanImages, clearScanImages }}>
      {children}
    </ScanContext.Provider>
  );
}

export function useScanContext() {
  const context = useContext(ScanContext);
  if (!context) {
    throw new Error('useScanContext must be used within ScanProvider');
  }
  return context;
}

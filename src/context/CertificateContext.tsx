import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";

interface CachedCertificate {
  file: File;
  password: string;
}

interface CertificateContextValue {
  certificate: CachedCertificate | null;
  setCertificate: (file: File, password: string) => void;
  clearCertificate: () => void;
}

const CertificateContext = createContext<CertificateContextValue>({
  certificate: null,
  setCertificate: () => {},
  clearCertificate: () => {},
});

/**
 * Guarda el certificado digital (.p12) y su contraseña SOLO en memoria,
 * durante lo que dure la sesión del navegador (nunca en localStorage, disco
 * ni base de datos). Se olvida automáticamente al cerrar sesión o recargar
 * la página, para no dejarlo expuesto más tiempo del necesario.
 */
export function CertificateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [certificate, setCert] = useState<CachedCertificate | null>(null);

  useEffect(() => {
    if (!user) setCert(null);
  }, [user]);

  return (
    <CertificateContext.Provider
      value={{
        certificate,
        setCertificate: (file, password) => setCert({ file, password }),
        clearCertificate: () => setCert(null),
      }}
    >
      {children}
    </CertificateContext.Provider>
  );
}

export function useCertificate() {
  return useContext(CertificateContext);
}

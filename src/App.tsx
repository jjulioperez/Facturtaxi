import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProfileProvider } from "./context/ProfileContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RequireApproved from "./components/RequireApproved";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewInvoice from "./pages/NewInvoice";
import InvoiceHistory from "./pages/InvoiceHistory";
import Template from "./pages/Template";
import ConfigMissing from "./pages/ConfigMissing";
import { isSupabaseConfigured } from "./lib/supabaseClient";

export default function App() {
  if (!isSupabaseConfigured) return <ConfigMissing />;

  return (
    <AuthProvider>
      <ProfileProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<RequireApproved />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/nueva-factura" element={<NewInvoice />} />
                  <Route path="/facturas" element={<InvoiceHistory />} />
                  <Route path="/plantilla" element={<Template />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </HashRouter>
      </ProfileProvider>
    </AuthProvider>
  );
}

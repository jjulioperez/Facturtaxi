import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { sharePdfBase64 } from "../lib/shareFile";
import { pick } from "@react-native-documents/picker";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import { listClients, createClient } from "../lib/clients";
import { buildInvoiceCore, computeAmounts, createInvoice, reserveInvoiceNumber, type ServiceDetails } from "../lib/invoices";
import { generateInvoicePdf } from "../lib/pdf/generateInvoicePdf";
import { signPdfWithCertificate } from "../lib/pdf/signPdf";
import type { Client, Invoice } from "../types";
import { colors } from "../theme";
import Spinner from "../components/Spinner";

type Step = "form" | "sign" | "done";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewInvoiceScreen() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [newClient, setNewClient] = useState({ name: "", tax_id: "", address: "", phone: "", email: "" });

  const [serviceDate, setServiceDate] = useState(todayIso());
  const [serviceOrigin, setServiceOrigin] = useState("");
  const [serviceDestination, setServiceDestination] = useState("");
  const [serviceTime, setServiceTime] = useState("");
  const [tariffNumber, setTariffNumber] = useState("");
  const [supplements, setSupplements] = useState("");
  const [description, setDescription] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [ivaRate, setIvaRate] = useState("10");

  const [signWithCertificate, setSignWithCertificate] = useState(false);
  const [certFile, setCertFile] = useState<{ uri: string; name: string } | null>(null);
  const [certPassword, setCertPassword] = useState("");

  const [step, setStep] = useState<Step>("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingClient, setPendingClient] = useState<Client | null>(null);
  const [finalPdfBytes, setFinalPdfBytes] = useState<Uint8Array | null>(null);
  const [finalInvoice, setFinalInvoice] = useState<Invoice | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    listClients()
      .then(setClients)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los clientes"))
      .finally(() => setClientsLoading(false));
  }, []);

  useEffect(() => {
    if (profile) setIvaRate(String(profile.default_iva));
  }, [profile]);

  const base = parseFloat(baseAmount.replace(",", ".")) || 0;
  const iva = parseFloat(ivaRate.replace(",", ".")) || 0;
  const { ivaAmount, total } = useMemo(() => computeAmounts(base, iva), [base, iva]);

  if (profileLoading) return <Spinner label="Cargando..." />;

  function buildService(): ServiceDetails {
    return {
      description,
      service_origin: serviceOrigin,
      service_destination: serviceDestination,
      service_time: serviceTime,
      tariff_number: tariffNumber,
      supplements,
    };
  }

  async function resolveClient(): Promise<Client> {
    if (clientMode === "existing") {
      const found = clients.find((c) => c.id === selectedClientId);
      if (!found) throw new Error("Selecciona un cliente");
      return found;
    }
    if (!newClient.name.trim()) throw new Error("El nombre del cliente es obligatorio");
    if (!user) throw new Error("Sesión no válida");
    return createClient(user.id, newClient);
  }

  async function handlePickCertificate() {
    try {
      const [result] = await pick({ type: ["application/x-pkcs12", "application/octet-stream", "*/*"] });
      if (result) setCertFile({ uri: result.uri, name: result.name ?? "certificado.p12" });
    } catch {
      // Usuario canceló el selector de archivos.
    }
  }

  async function handleSubmit() {
    setError(null);
    if (!user || !profile) return;
    if (base <= 0) {
      setError("El importe base debe ser mayor que 0");
      return;
    }

    setBusy(true);
    try {
      const client = await resolveClient();
      setPendingClient(client);

      if (signWithCertificate) {
        setStep("sign");
        setBusy(false);
        return;
      }

      await finishInvoice(client);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ha ocurrido un error");
      setBusy(false);
    }
  }

  async function finishInvoice(client: Client, signedPdfBytes?: Uint8Array, preAllocatedNumber?: number) {
    if (!user || !profile) return;
    setBusy(true);
    setError(null);
    try {
      const { invoice, pdfBytes } = await createInvoice(user.id, profile, {
        client,
        serviceDate,
        service: buildService(),
        baseAmount: base,
        ivaRate: iva,
        signedPdfBytes,
        preAllocatedNumber,
      });
      setFinalPdfBytes(pdfBytes);
      setFinalInvoice(invoice);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la factura");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignAndFinish() {
    if (!pendingClient || !profile || !certFile || !certPassword) {
      setError("Selecciona el certificado .p12/.pfx y escribe la contraseña");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const series = profile.invoice_series_prefix;
      const number = await reserveInvoiceNumber(series);
      const draftInvoice = buildInvoiceCore(series, number, base, iva, serviceDate, buildService());
      const unsignedPdf = await generateInvoicePdf({
        profile,
        client: pendingClient,
        invoice: draftInvoice,
        signedWithCertificate: true,
      });
      // React Native's fetch sabe leer URIs "content://" (Android) y "file://"
      // (iOS) directamente, sin necesitar copiar el archivo a disco antes.
      const certResponse = await fetch(certFile.uri);
      const certArrayBuffer = await certResponse.arrayBuffer();
      const signedPdf = await signPdfWithCertificate(unsignedPdf, certArrayBuffer, certPassword);
      await finishInvoice(pendingClient, signedPdf, number);
      setCertPassword("");
    } catch (err) {
      setError(
        err instanceof Error
          ? `No se pudo firmar el PDF (revisa el certificado y la contraseña): ${err.message}`
          : "No se pudo firmar el PDF"
      );
      setBusy(false);
    }
  }

  async function handleShareFinal() {
    if (!finalPdfBytes || !finalInvoice) return;
    setSharing(true);
    try {
      const base64 = Buffer.from(finalPdfBytes).toString("base64");
      const label = `${finalInvoice.series}-${String(finalInvoice.number).padStart(4, "0")}`;
      await sharePdfBase64(base64, `factura-${label}`);
    } catch (err) {
      if (err instanceof Error && !/user did not share/i.test(err.message)) {
        setError(err.message);
      }
    } finally {
      setSharing(false);
    }
  }

  function resetForm() {
    setStep("form");
    setPendingClient(null);
    setFinalPdfBytes(null);
    setFinalInvoice(null);
    setServiceOrigin("");
    setServiceDestination("");
    setServiceTime("");
    setTariffNumber("");
    setSupplements("");
    setDescription("");
    setBaseAmount("");
    setSignWithCertificate(false);
    setCertFile(null);
  }

  if (step === "sign" && pendingClient) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        <Text style={styles.title}>Firmar con certificado digital</Text>
        <View style={styles.card}>
          <Text style={styles.helpText}>
            Selecciona tu certificado (.p12 o .pfx) y escribe su contraseña. Todo ocurre en tu
            móvil: no se envían a ningún servidor.
          </Text>

          {certFile ? (
            <View style={styles.certRow}>
              <Text style={styles.certName}>🔒 {certFile.name}</Text>
              <TouchableOpacity onPress={handlePickCertificate}>
                <Text style={styles.linkText}>Cambiar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.secondaryButton} onPress={handlePickCertificate}>
              <Text style={styles.secondaryButtonText}>Seleccionar certificado (.p12 / .pfx)</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.label}>Contraseña del certificado</Text>
          <TextInput
            style={styles.input}
            value={certPassword}
            onChangeText={setCertPassword}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep("form")} disabled={busy}>
              <Text style={styles.secondaryButtonText}>Volver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryButton, styles.flex1]} onPress={handleSignAndFinish} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Firmar y emitir</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  if (step === "done" && finalInvoice) {
    const label = `${finalInvoice.series}-${String(finalInvoice.number).padStart(4, "0")}`;
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.doneEmoji}>✅</Text>
          <Text style={styles.doneTitle}>Factura {label} emitida</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleShareFinal} disabled={sharing}>
            {sharing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>📤 Compartir factura</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={resetForm}>
            <Text style={styles.secondaryButtonText}>Nueva factura</Text>
          </TouchableOpacity>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Nueva factura</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Cliente</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.toggleButton, clientMode === "existing" && styles.toggleButtonActive]}
            onPress={() => setClientMode("existing")}
          >
            <Text style={clientMode === "existing" ? styles.toggleTextActive : styles.toggleText}>Existente</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, clientMode === "new" && styles.toggleButtonActive]}
            onPress={() => setClientMode("new")}
          >
            <Text style={clientMode === "new" ? styles.toggleTextActive : styles.toggleText}>Nuevo</Text>
          </TouchableOpacity>
        </View>

        {clientMode === "existing" ? (
          clientsLoading ? (
            <ActivityIndicator />
          ) : clients.length === 0 ? (
            <Text style={styles.helpText}>No tienes clientes todavía. Crea uno nuevo.</Text>
          ) : (
            <View style={styles.clientList}>
              {clients.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.clientRow, selectedClientId === c.id && styles.clientRowActive]}
                  onPress={() => setSelectedClientId(c.id)}
                >
                  <Text style={selectedClientId === c.id ? styles.clientNameActive : styles.clientName}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )
        ) : (
          <>
            <Text style={styles.label}>Nombre / Razón social</Text>
            <TextInput style={styles.input} value={newClient.name} onChangeText={(v) => setNewClient((c) => ({ ...c, name: v }))} />
            <Text style={styles.label}>NIF / CIF</Text>
            <TextInput style={styles.input} value={newClient.tax_id} onChangeText={(v) => setNewClient((c) => ({ ...c, tax_id: v }))} />
            <Text style={styles.label}>Teléfono</Text>
            <TextInput style={styles.input} value={newClient.phone} onChangeText={(v) => setNewClient((c) => ({ ...c, phone: v }))} />
            <Text style={styles.label}>Dirección</Text>
            <TextInput style={styles.input} value={newClient.address} onChangeText={(v) => setNewClient((c) => ({ ...c, address: v }))} />
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={newClient.email} onChangeText={(v) => setNewClient((c) => ({ ...c, email: v }))} />
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Servicio</Text>
        <Text style={styles.label}>Fecha del servicio (AAAA-MM-DD)</Text>
        <TextInput style={styles.input} value={serviceDate} onChangeText={setServiceDate} />
        <Text style={styles.label}>Hora (HH:MM)</Text>
        <TextInput style={styles.input} value={serviceTime} onChangeText={setServiceTime} placeholder="14:30" placeholderTextColor="#94a3b8" />
        <Text style={styles.label}>Origen</Text>
        <TextInput style={styles.input} value={serviceOrigin} onChangeText={setServiceOrigin} placeholder="Ej: Aeropuerto de Jerez" placeholderTextColor="#94a3b8" />
        <Text style={styles.label}>Destino</Text>
        <TextInput style={styles.input} value={serviceDestination} onChangeText={setServiceDestination} placeholder="Ej: Centro ciudad, Cádiz" placeholderTextColor="#94a3b8" />
        <Text style={styles.label}>Nº de tarifa aplicada</Text>
        <TextInput style={styles.input} value={tariffNumber} onChangeText={setTariffNumber} placeholder="Ej: Tarifa 2" placeholderTextColor="#94a3b8" />
        <Text style={styles.label}>Suplementos</Text>
        <TextInput style={styles.input} value={supplements} onChangeText={setSupplements} placeholder="Ej: Equipaje 3€" placeholderTextColor="#94a3b8" />
        <Text style={styles.label}>Observaciones (opcional)</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription} />
        <Text style={styles.label}>Importe base (€)</Text>
        <TextInput style={styles.input} value={baseAmount} onChangeText={setBaseAmount} keyboardType="decimal-pad" />
        <Text style={styles.label}>IVA (%)</Text>
        <TextInput style={styles.input} value={ivaRate} onChangeText={setIvaRate} keyboardType="decimal-pad" />

        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Base imponible</Text>
            <Text>{base.toFixed(2)} €</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>IVA ({iva || 0}%)</Text>
            <Text>{ivaAmount.toFixed(2)} €</Text>
          </View>
          <View style={[styles.totalsRow, styles.totalsFinal]}>
            <Text style={styles.totalsFinalLabel}>Total</Text>
            <Text style={styles.totalsFinalLabel}>{total.toFixed(2)} €</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <Switch value={signWithCertificate} onValueChange={setSignWithCertificate} trackColor={{ true: colors.brand }} />
          <Text style={styles.switchLabel}>Firmar con certificado digital (.p12/.pfx)</Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>
            {signWithCertificate ? "Continuar a la firma" : "Generar factura"}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, gap: 14, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 10 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, gap: 4 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: colors.text,
  },
  helpText: { fontSize: 13, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13 },
  buttonRow: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },
  toggleButton: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: "#f1f5f9" },
  toggleButtonActive: { backgroundColor: colors.brand },
  toggleText: { color: colors.text, fontWeight: "600" },
  toggleTextActive: { color: "#fff", fontWeight: "700" },
  clientList: { marginTop: 10, gap: 8 },
  clientRow: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12 },
  clientRowActive: { borderColor: colors.brand, backgroundColor: "#f0fdfa" },
  clientName: { color: colors.text },
  clientNameActive: { color: colors.brandDark, fontWeight: "700" },
  totalsBox: { backgroundColor: "#f8fafc", borderRadius: 10, padding: 12, marginTop: 14, gap: 4 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalsLabel: { color: colors.textMuted },
  totalsFinal: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6, marginTop: 4 },
  totalsFinalLabel: { fontWeight: "700", color: colors.text },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  switchLabel: { flex: 1, color: colors.text, fontSize: 14 },
  primaryButton: { backgroundColor: colors.brand, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  secondaryButtonText: { color: colors.text, fontWeight: "600" },
  certRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f8fafc", borderRadius: 10, padding: 12 },
  certName: { color: colors.text, flex: 1 },
  linkText: { color: colors.brandDark, fontWeight: "600" },
  doneEmoji: { fontSize: 40, textAlign: "center", marginBottom: 6 },
  doneTitle: { fontSize: 17, fontWeight: "700", textAlign: "center", color: colors.text, marginBottom: 16 },
});

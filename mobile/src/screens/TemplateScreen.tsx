import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import { updateProfile } from "../lib/profile";
import { setInvoiceCounter } from "../lib/invoices";
import type { TemplateStyle } from "../types";
import { colors } from "../theme";
import Spinner from "../components/Spinner";

const STYLES: { value: TemplateStyle; label: string }[] = [
  { value: "clasico", label: "Clásico" },
  { value: "moderno", label: "Moderno" },
  { value: "simple", label: "Simple" },
];

export default function TemplateScreen() {
  const { user } = useAuth();
  const { profile, loading, refresh } = useProfile();

  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [seriesPrefix, setSeriesPrefix] = useState("");
  const [defaultIva, setDefaultIva] = useState("10");
  const [accentColor, setAccentColor] = useState("#0d9488");
  const [templateStyle, setTemplateStyle] = useState<TemplateStyle>("clasico");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [nextNumber, setNextNumber] = useState("1");
  const [numberSaving, setNumberSaving] = useState(false);
  const [numberMessage, setNumberMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setCompanyName(profile.company_name ?? "");
    setTaxId(profile.tax_id ?? "");
    setAddress(profile.address ?? "");
    setPhone(profile.phone ?? "");
    setEmail(profile.email ?? "");
    setSeriesPrefix(profile.invoice_series_prefix ?? "");
    setDefaultIva(String(profile.default_iva ?? 10));
    setAccentColor(profile.accent_color ?? "#0d9488");
    setTemplateStyle(profile.template_style ?? "clasico");
  }, [profile]);

  if (loading) return <Spinner label="Cargando plantilla..." />;

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile(user.id, {
        company_name: companyName,
        tax_id: taxId,
        address,
        phone,
        email,
        invoice_series_prefix: seriesPrefix,
        default_iva: parseFloat(defaultIva.replace(",", ".")) || 0,
        accent_color: accentColor,
        template_style: templateStyle,
      });
      await refresh();
      setMessage("Datos guardados correctamente.");
    } catch (err) {
      setMessage(err instanceof Error ? `Error: ${err.message}` : "No se pudieron guardar los datos.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetNextNumber() {
    const n = parseInt(nextNumber, 10);
    if (!Number.isInteger(n) || n < 1) {
      setNumberMessage("Introduce un número entero de 1 o mayor.");
      return;
    }
    setNumberSaving(true);
    setNumberMessage(null);
    try {
      await setInvoiceCounter(seriesPrefix, n);
      setNumberMessage(`Hecho: tu próxima factura será ${seriesPrefix}-${String(n).padStart(4, "0")}.`);
    } catch (err) {
      setNumberMessage(err instanceof Error ? `Error: ${err.message}` : "No se pudo actualizar el número.");
    } finally {
      setNumberSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Plantilla de factura</Text>
      <Text style={styles.subtitle}>Estos datos se usan para generar todas tus facturas.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Datos fiscales</Text>
        <Text style={styles.label}>Nombre / Razón social</Text>
        <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} />
        <Text style={styles.label}>NIF / CIF</Text>
        <TextInput style={styles.input} value={taxId} onChangeText={setTaxId} />
        <Text style={styles.label}>Dirección</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} />
        <Text style={styles.label}>Teléfono</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Facturación</Text>
        <Text style={styles.label}>Prefijo de serie</Text>
        <TextInput style={styles.input} value={seriesPrefix} onChangeText={setSeriesPrefix} placeholder="2026" placeholderTextColor="#94a3b8" />
        <Text style={styles.hint}>Ej: "2026" da facturas 2026-0001, 2026-0002...</Text>
        <Text style={styles.label}>IVA por defecto (%)</Text>
        <TextInput style={styles.input} value={defaultIva} onChangeText={setDefaultIva} keyboardType="decimal-pad" />

        <View style={styles.divider} />
        <Text style={styles.label}>Próximo número de factura (serie {seriesPrefix || "—"})</Text>
        <Text style={styles.hint}>Útil para continuar la numeración de facturas emitidas fuera de la app.</Text>
        <View style={styles.numberRow}>
          <TextInput style={[styles.input, styles.flex1]} value={nextNumber} onChangeText={setNextNumber} keyboardType="number-pad" />
          <TouchableOpacity style={styles.secondaryButton} onPress={handleSetNextNumber} disabled={numberSaving}>
            {numberSaving ? <ActivityIndicator color={colors.text} /> : <Text style={styles.secondaryButtonText}>Actualizar</Text>}
          </TouchableOpacity>
        </View>
        {numberMessage ? <Text style={styles.hint}>{numberMessage}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Diseño</Text>
        <Text style={styles.label}>Color de acento (hex)</Text>
        <TextInput style={styles.input} value={accentColor} onChangeText={setAccentColor} autoCapitalize="none" />
        <Text style={styles.label}>Estilo de plantilla</Text>
        <View style={styles.styleRow}>
          {STYLES.map((s) => (
            <TouchableOpacity
              key={s.value}
              style={[styles.styleButton, templateStyle === s.value && styles.styleButtonActive]}
              onPress={() => setTemplateStyle(s.value)}
            >
              <Text style={templateStyle === s.value ? styles.styleTextActive : styles.styleText}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>
          El logo, sello y firma manual se gestionan desde la web por ahora (Plantilla) — próximamente aquí también.
        </Text>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Guardar cambios</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, gap: 14, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: -8 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  numberRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  flex1: { flex: 1 },
  secondaryButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center" },
  secondaryButtonText: { color: colors.text, fontWeight: "600" },
  styleRow: { flexDirection: "row", gap: 8 },
  styleButton: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: "#f1f5f9" },
  styleButtonActive: { backgroundColor: colors.brand },
  styleText: { color: colors.text, fontWeight: "600", fontSize: 13 },
  styleTextActive: { color: "#fff", fontWeight: "700", fontSize: 13 },
  message: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
  primaryButton: { backgroundColor: colors.brand, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

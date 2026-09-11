import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Share from "react-native-share";
import { downloadInvoicePdf, listInvoices } from "../lib/invoices";
import type { InvoiceWithClient } from "../types";
import { colors } from "../theme";
import Spinner from "../components/Spinner";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function InvoiceHistoryScreen() {
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sharingId, setSharingId] = useState<string | null>(null);

  useEffect(() => {
    listInvoices()
      .then(setInvoices)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar las facturas"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = invoices.filter((inv) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const fullNumber = `${inv.series}-${String(inv.number).padStart(4, "0")}`.toLowerCase();
    return fullNumber.includes(q) || inv.clients?.name?.toLowerCase().includes(q);
  });

  async function handleShare(inv: InvoiceWithClient) {
    if (!inv.pdf_path) return;
    setSharingId(inv.id);
    setError(null);
    try {
      const blob = await downloadInvoicePdf(inv.pdf_path);
      const base64 = await blobToBase64(blob);
      const label = `${inv.series}-${String(inv.number).padStart(4, "0")}`;
      await Share.open({
        url: `data:application/pdf;base64,${base64}`,
        type: "application/pdf",
        filename: `factura-${label}`,
        failOnCancel: false,
      });
    } catch (err) {
      if (err instanceof Error && !/user did not share/i.test(err.message)) {
        setError(err.message);
      }
    } finally {
      setSharingId(null);
    }
  }

  if (loading) return <Spinner label="Cargando facturas..." />;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Historial de facturas</Text>
        <TextInput
          style={styles.search}
          placeholder="Buscar por número o cliente..."
          placeholderTextColor="#94a3b8"
          value={query}
          onChangeText={setQuery}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No hay facturas que mostrar.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowNumber}>
                {item.series}-{String(item.number).padStart(4, "0")}
                {item.signed_with_certificate ? " 🔏" : ""}
              </Text>
              <Text style={styles.rowMeta}>
                {formatDate(item.issue_date)} · {item.clients?.name ?? "—"}
              </Text>
            </View>
            <Text style={styles.rowAmount}>{item.total_amount.toFixed(2)} €</Text>
            <TouchableOpacity style={styles.shareButton} onPress={() => handleShare(item)} disabled={sharingId === item.id}>
              {sharingId === item.id ? <ActivityIndicator size="small" color={colors.brandDark} /> : <Text style={styles.shareButtonText}>📤</Text>}
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { padding: 16, gap: 10 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    backgroundColor: colors.card,
  },
  error: { color: colors.danger, fontSize: 13 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  rowInfo: { flex: 1 },
  rowNumber: { fontWeight: "700", color: colors.text },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  rowAmount: { fontWeight: "700", color: colors.text },
  shareButton: { padding: 8 },
  shareButtonText: { fontSize: 18 },
});

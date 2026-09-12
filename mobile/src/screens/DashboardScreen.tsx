import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NavigationProp } from "@react-navigation/native";
import { useProfile } from "../context/ProfileContext";
import { listInvoices } from "../lib/invoices";
import type { InvoiceWithClient } from "../types";
import { colors } from "../theme";
import Spinner from "../components/Spinner";

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function DashboardScreen({ navigation }: { navigation: NavigationProp<any> }) {
  const { profile, loading: profileLoading } = useProfile();
  const [recent, setRecent] = useState<InvoiceWithClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listInvoices()
      .then((all) => setRecent(all.slice(0, 5)))
      .finally(() => setLoading(false));
  }, []);

  const profileIncomplete = !profileLoading && profile && (!profile.company_name || !profile.tax_id);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Hola{profile?.company_name ? `, ${profile.company_name}` : ""} 👋</Text>
      <Text style={styles.subtitle}>Genera y gestiona tus facturas de taxi.</Text>

      {profileIncomplete ? (
        <TouchableOpacity style={styles.warningCard} onPress={() => navigation.navigate("Plantilla")}>
          <Text style={styles.warningText}>
            Todavía no has completado tus datos fiscales. Complétalos en Plantilla antes de emitir tu primera
            factura.
          </Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("NuevaFactura")}>
        <Text style={styles.primaryButtonText}>🧾 Nueva factura</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>Últimas facturas</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Historial")}>
            <Text style={styles.linkText}>Ver todas</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <Spinner />
        ) : recent.length === 0 ? (
          <Text style={styles.empty}>Aún no has emitido ninguna factura.</Text>
        ) : (
          recent.map((inv) => (
            <View key={inv.id} style={styles.invoiceRow}>
              <View style={styles.flex1}>
                <Text style={styles.invoiceNumber}>
                  {inv.series}-{String(inv.number).padStart(4, "0")}
                </Text>
                <Text style={styles.invoiceMeta}>
                  {formatDate(inv.issue_date)} · {inv.clients?.name ?? "—"}
                </Text>
              </View>
              <Text style={styles.invoiceAmount}>{inv.total_amount.toFixed(2)} €</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, gap: 14, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: -8 },
  warningCard: { backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fcd34d", borderRadius: 12, padding: 14 },
  warningText: { color: "#92400e", fontSize: 13 },
  primaryButton: { backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  linkText: { color: colors.brandDark, fontSize: 13, fontWeight: "600" },
  empty: { textAlign: "center", color: colors.textMuted, paddingVertical: 20, fontSize: 13 },
  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  flex1: { flex: 1 },
  invoiceNumber: { fontWeight: "600", color: colors.text, fontSize: 14 },
  invoiceMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  invoiceAmount: { fontWeight: "700", color: colors.text },
});

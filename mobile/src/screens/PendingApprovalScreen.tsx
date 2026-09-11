import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { supabase } from "../lib/supabaseClient";
import { colors } from "../theme";

export default function PendingApprovalScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>⏳</Text>
      <Text style={styles.title}>Cuenta pendiente de aprobación</Text>
      <Text style={styles.body}>
        Tu cuenta se ha creado correctamente, pero todavía tiene que aprobarla el administrador antes
        de que puedas usar la app.
      </Text>
      <TouchableOpacity style={styles.button} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.buttonText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: colors.bg, gap: 8 },
  emoji: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "center" },
  body: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: 4 },
  button: { marginTop: 20, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: colors.text, fontWeight: "600" },
});

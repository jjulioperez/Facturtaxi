import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabaseClient";
import { colors } from "../theme";

export default function LoginScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setInfo("Cuenta creada. Un administrador debe aprobarla antes de poder usarla.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ha ocurrido un error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.emoji}>🚕</Text>
        <Text style={styles.title}>Facturtaxi</Text>
        <Text style={styles.subtitle}>Facturas al vuelo para taxistas</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="tu@email.com"
            placeholderTextColor="#94a3b8"
          />
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor="#94a3b8"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {info ? <Text style={styles.info}>{info}</Text> : null}

          <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === "signin" ? "Iniciar sesión" : "Crear cuenta"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode(mode === "signin" ? "signup" : "signin")}>
            <Text style={styles.switchModeText}>
              {mode === "signin" ? "¿No tienes cuenta? Crear una" : "¿Ya tienes cuenta? Iniciar sesión"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emoji: { fontSize: 40, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: "700", color: colors.brandDark },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: 24 },
  card: { width: "100%", maxWidth: 360, backgroundColor: colors.card, borderRadius: 16, padding: 20, gap: 4 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 10 },
  info: { color: colors.brandDark, fontSize: 13, marginTop: 10 },
  primaryButton: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 18,
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  switchModeText: { textAlign: "center", color: colors.textMuted, fontSize: 13, marginTop: 14 },
});

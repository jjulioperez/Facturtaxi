import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function Spinner({ label }: { label?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0d9488" />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  label: { color: "#64748b", fontSize: 14 },
});

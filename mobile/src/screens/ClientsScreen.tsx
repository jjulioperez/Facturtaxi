import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { createClient, deleteClient, listClients, updateClient, type NewClientInput } from "../lib/clients";
import type { Client } from "../types";
import { colors } from "../theme";
import Spinner from "../components/Spinner";

const emptyForm: NewClientInput = { name: "", tax_id: "", address: "", phone: "", email: "" };

export default function ClientsScreen() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NewClientInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    listClients()
      .then(setClients)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los clientes"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filtered = clients.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.tax_id ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  function startCreate() {
    setEditingId(null);
    setCreating(true);
    setForm(emptyForm);
    setError(null);
  }

  function startEdit(client: Client) {
    setCreating(false);
    setEditingId(client.id);
    setForm({
      name: client.name,
      tax_id: client.tax_id ?? "",
      address: client.address ?? "",
      phone: client.phone ?? "",
      email: client.email ?? "",
    });
    setError(null);
  }

  function cancelForm() {
    setCreating(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        const updated = await updateClient(editingId, form);
        setClients((cs) => cs.map((c) => (c.id === editingId ? updated : c)));
      } else if (user) {
        const created = await createClient(user.id, form);
        setClients((cs) => [...cs, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      cancelForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cliente");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(client: Client) {
    Alert.alert("Eliminar cliente", `¿Eliminar a "${client.name}"? Esta acción no se puede deshacer.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => handleDelete(client) },
    ]);
  }

  async function handleDelete(client: Client) {
    setDeletingId(client.id);
    setError(null);
    try {
      await deleteClient(client.id);
      setClients((cs) => cs.filter((c) => c.id !== client.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el cliente");
    } finally {
      setDeletingId(null);
    }
  }

  const showForm = creating || editingId !== null;

  if (loading) return <Spinner label="Cargando clientes..." />;

  return (
    <View style={styles.screen}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Clientes</Text>
              {!showForm && (
                <TouchableOpacity style={styles.addButton} onPress={startCreate}>
                  <Text style={styles.addButtonText}>+ Nuevo</Text>
                </TouchableOpacity>
              )}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {showForm ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{editingId ? "Editar cliente" : "Nuevo cliente"}</Text>
                <Text style={styles.label}>Nombre / Razón social</Text>
                <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />
                <Text style={styles.label}>NIF / CIF</Text>
                <TextInput style={styles.input} value={form.tax_id} onChangeText={(v) => setForm((f) => ({ ...f, tax_id: v }))} />
                <Text style={styles.label}>Teléfono</Text>
                <TextInput style={styles.input} value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} />
                <Text style={styles.label}>Dirección</Text>
                <TextInput style={styles.input} value={form.address} onChangeText={(v) => setForm((f) => ({ ...f, address: v }))} />
                <Text style={styles.label}>Email</Text>
                <TextInput style={styles.input} value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} />
                <View style={styles.formButtons}>
                  <TouchableOpacity style={styles.secondaryButton} onPress={cancelForm} disabled={saving}>
                    <Text style={styles.secondaryButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.primaryButton, styles.flex1]} onPress={handleSubmit} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TextInput
                style={styles.search}
                placeholder="Buscar por nombre, NIF o email..."
                placeholderTextColor="#94a3b8"
                value={query}
                onChangeText={setQuery}
              />
            )}
          </View>
        }
        ListEmptyComponent={!showForm ? <Text style={styles.empty}>No hay clientes que mostrar.</Text> : undefined}
        renderItem={({ item }) =>
          showForm ? null : (
            <View style={styles.row}>
              <View style={styles.flex1}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>{item.tax_id || "—"}</Text>
              </View>
              <TouchableOpacity style={styles.editButton} onPress={() => startEdit(item)}>
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={() => confirmDelete(item)} disabled={deletingId === item.id}>
                {deletingId === item.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deleteButtonText}>Eliminar</Text>
                )}
              </TouchableOpacity>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  listContent: { padding: 16, gap: 8, paddingBottom: 40 },
  header: { gap: 12, marginBottom: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  addButton: { backgroundColor: colors.brand, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addButtonText: { color: "#fff", fontWeight: "700" },
  error: { color: colors.danger, fontSize: 13 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, gap: 4 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: colors.text },
  formButtons: { flexDirection: "row", gap: 10, marginTop: 16 },
  flex1: { flex: 1 },
  primaryButton: { backgroundColor: colors.brand, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  secondaryButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
  secondaryButtonText: { color: colors.text, fontWeight: "600" },
  search: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, backgroundColor: colors.card },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 30 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 8 },
  rowName: { fontWeight: "700", color: colors.text },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  editButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  editButtonText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  deleteButton: { backgroundColor: colors.danger, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, minWidth: 66, alignItems: "center" },
  deleteButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { createClient, deleteClient, listClients, updateClient, type NewClientInput } from "../lib/clients";
import type { Client } from "../types";
import Spinner from "../components/Spinner";

const emptyForm: NewClientInput = { name: "", tax_id: "", address: "", phone: "", email: "" };

export default function Clients() {
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.tax_id?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
    );
  }, [clients, query]);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
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

  async function handleDelete(client: Client) {
    if (!window.confirm(`¿Eliminar al cliente "${client.name}"? Esta acción no se puede deshacer.`)) return;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Clientes</h1>
          <p className="text-sm text-slate-500">Consulta y edita los datos de tus clientes.</p>
        </div>
        {!showForm && (
          <button className="btn-primary" onClick={startCreate}>
            + Nuevo cliente
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">
            {editingId ? "Editar cliente" : "Nuevo cliente"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Nombre / Razón social</label>
              <input
                className="input"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">NIF / CIF</label>
              <input
                className="input"
                value={form.tax_id}
                onChange={(e) => setForm((f) => ({ ...f, tax_id: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Dirección</label>
              <input
                className="input"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={cancelForm} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      )}

      <input
        className="input"
        placeholder="Buscar por nombre, NIF o email..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <div className="card text-center text-sm text-slate-400">No hay clientes que mostrar.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">NIF/CIF</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{c.tax_id || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{c.phone || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{c.email || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => startEdit(c)}>
                        Editar
                      </button>
                      <button
                        className="btn-danger px-3 py-1.5 text-xs"
                        disabled={deletingId === c.id}
                        onClick={() => handleDelete(c)}
                      >
                        {deletingId === c.id ? "..." : "Eliminar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

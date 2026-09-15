"use client";

import { useEffect, useState } from "react";

type UserRole = "supervisor" | "encargado";

type UserProfile = {
  id: string;
  name: string;
  role: UserRole;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type CreateForm = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

type EditForm = {
  name: string;
  role: UserRole;
};

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editingUser, setEditingUser] =
    useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [createForm, setCreateForm] = useState<CreateForm>({
    name: "",
    email: "",
    password: "",
    role: "encargado",
  });

  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    role: "encargado",
  });

  async function loadUsers() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/usuarios", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No se pudieron cargar los usuarios."
        );
      }

      setUsers(data.users ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los usuarios."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function resetMessages() {
    setError("");
    setSuccess("");
  }

  function openCreateModal() {
    resetMessages();

    setCreateForm({
      name: "",
      email: "",
      password: "",
      role: "encargado",
    });

    setShowCreate(true);
  }

  function closeCreateModal() {
    if (creating) return;
    setShowCreate(false);
  }

  async function createUser() {
    resetMessages();

    if (!createForm.name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    if (!createForm.email.trim()) {
      setError("El correo es obligatorio.");
      return;
    }

    if (createForm.password.length < 6) {
      setError(
        "La contraseña debe tener al menos 6 caracteres."
      );
      return;
    }

    setCreating(true);

    try {
      const response = await fetch("/api/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: createForm.name.trim(),
          email: createForm.email.trim(),
          password: createForm.password,
          role: createForm.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No se pudo crear el usuario."
        );
      }

      setShowCreate(false);

      setSuccess(
        `Usuario "${createForm.name.trim()}" creado correctamente.`
      );

      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo crear el usuario."
      );
    } finally {
      setCreating(false);
    }
  }

  function openEditModal(user: UserProfile) {
    resetMessages();

    setEditingUser(user);

    setEditForm({
      name: user.name,
      role: user.role,
    });
  }

  function closeEditModal() {
    if (saving) return;
    setEditingUser(null);
  }

  async function saveUser() {
    if (!editingUser) return;

    resetMessages();

    if (!editForm.name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: editingUser.id,
          name: editForm.name.trim(),
          role: editForm.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No se pudo actualizar el usuario."
        );
      }

      setEditingUser(null);

      setSuccess("Usuario actualizado correctamente.");

      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar el usuario."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleUser(user: UserProfile) {
    resetMessages();

    const action = user.active
      ? "desactivar"
      : "activar";

    const confirmed = window.confirm(
      `¿Seguro que quieres ${action} a ${user.name}?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          active: !user.active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            `No se pudo ${action} el usuario.`
        );
      }

      setSuccess(
        user.active
          ? `${user.name} fue desactivado.`
          : `${user.name} fue activado.`
      );

      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `No se pudo ${action} el usuario.`
      );
    }
  }

  const activeUsers = users.filter(
    (user) => user.active
  ).length;

  const inactiveUsers = users.filter(
    (user) => !user.active
  ).length;

  const supervisors = users.filter(
    (user) => user.role === "supervisor" && user.active
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Usuarios
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Administra los usuarios y vendedores de CafeteríaOS.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          + Nuevo usuario
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Usuarios
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {users.length}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Activos
          </p>

          <p className="mt-2 text-2xl font-semibold text-green-600">
            {activeUsers}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Inactivos
          </p>

          <p className="mt-2 text-2xl font-semibold text-muted-foreground">
            {inactiveUsers}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Supervisores activos
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {supervisors}
          </p>
        </div>
      </div>

      {/* Users table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">
            Usuarios registrados
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Los usuarios inactivos conservan su historial.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Cargando usuarios...
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No hay usuarios registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-5 py-3 text-left font-medium">
                    Usuario
                  </th>

                  <th className="px-5 py-3 text-left font-medium">
                    Rol
                  </th>

                  <th className="px-5 py-3 text-left font-medium">
                    Estado
                  </th>

                  <th className="px-5 py-3 text-left font-medium">
                    Creado
                  </th>

                  <th className="px-5 py-3 text-right font-medium">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b last:border-0"
                  >
                    <td className="px-5 py-4">
                      <div className="font-medium">
                        {user.name}
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        {user.role === "supervisor"
                          ? "Administrador"
                          : "Vendedor / Encargado"}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {user.role === "supervisor" ? (
                        <span className="inline-flex rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">
                          Supervisor
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                          Encargado
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      {user.active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                          Inactivo
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-muted-foreground">
                      {new Intl.DateTimeFormat("es-CO", {
                        dateStyle: "medium",
                        timeZone: "America/Bogota",
                      }).format(
                        new Date(user.created_at)
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openEditModal(user)
                          }
                          className="rounded-lg border px-3 py-2 text-xs font-medium transition hover:bg-muted"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleUser(user)
                          }
                          className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                            user.active
                              ? "border-red-200 text-red-600 hover:bg-red-50"
                              : "border-green-200 text-green-600 hover:bg-green-50"
                          }`}
                        >
                          {user.active
                            ? "Desactivar"
                            : "Activar"}
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

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-background shadow-xl">
            <div className="border-b px-6 py-5">
              <h2 className="text-lg font-semibold">
                Nuevo usuario
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Crea el acceso para un supervisor o encargado.
              </p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Nombre
                </label>

                <input
                  type="text"
                  value={createForm.name}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Ej. Carlos Pérez"
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Correo
                </label>

                <input
                  type="email"
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="correo@ejemplo.com"
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Contraseña inicial
                </label>

                <input
                  type="password"
                  value={createForm.password}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Mínimo 6 caracteres"
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />

                <p className="mt-1.5 text-xs text-muted-foreground">
                  El usuario podrá utilizar esta contraseña para
                  ingresar a CafeteríaOS.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Rol
                </label>

                <select
                  value={createForm.role}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      role: event.target
                        .value as UserRole,
                    }))
                  }
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="encargado">
                    Encargado
                  </option>

                  <option value="supervisor">
                    Supervisor
                  </option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={creating}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={createUser}
                disabled={creating}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {creating
                  ? "Creando..."
                  : "Crear usuario"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-background shadow-xl">
            <div className="border-b px-6 py-5">
              <h2 className="text-lg font-semibold">
                Editar usuario
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Actualiza los datos y permisos del usuario.
              </p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Nombre
                </label>

                <input
                  type="text"
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Rol
                </label>

                <select
                  value={editForm.role}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      role: event.target
                        .value as UserRole,
                    }))
                  }
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="encargado">
                    Encargado
                  </option>

                  <option value="supervisor">
                    Supervisor
                  </option>
                </select>
              </div>

              <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
                <p className="font-medium">
                  Estado actual
                </p>

                <p className="mt-1 text-muted-foreground">
                  {editingUser.active
                    ? "Este usuario está activo."
                    : "Este usuario está inactivo."}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  El estado se cambia desde el botón Activar /
                  Desactivar de la tabla.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <button
                type="button"
                onClick={closeEditModal}
                disabled={saving}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={saveUser}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {saving
                  ? "Guardando..."
                  : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
};

type Account = {
  id: string;
  member_id: string;
  meeting_date: string;
  status: "open" | "paid" | "cancelled";
  total: number;
  opened_by: string | null;
  closed_at: string | null;
  created_at: string;
};

type AccountItem = {
  id: string;
  account_id: string;
  sale_id: string;
  created_at: string;
};

type SaleItem = {
  id: string;
  sale_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
};

type AccountSale = {
  saleId: string;
  createdAt: string;
  items: SaleItem[];
  total: number;
};

type PaymentMethod = "cash" | "nequi";

const supabase = createClient();

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getStatusLabel(status: Account["status"]) {
  if (status === "open") return "Abierta";
  if (status === "paid") return "Pagada";
  return "Cancelada";
}

export default function CuentasPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingMember, setSavingMember] = useState(false);
  const [openingAccount, setOpeningAccount] = useState(false);
  const [loadingAccountDetail, setLoadingAccountDetail] =
    useState(false);
  const [payingAccount, setPayingAccount] = useState(false);

  const [search, setSearch] = useState("");

  const [showMemberForm, setShowMemberForm] = useState(false);

  const [memberName, setMemberName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberNotes, setMemberNotes] = useState("");

  const [selectedMember, setSelectedMember] =
    useState<Member | null>(null);

  const [meetingDate, setMeetingDate] = useState(getToday());
  const [supervisorOverride, setSupervisorOverride] =
    useState(false);

  const [selectedAccount, setSelectedAccount] =
    useState<Account | null>(null);

  const [accountSales, setAccountSales] =
    useState<AccountSale[]>([]);

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const [membersResult, accountsResult] = await Promise.all([
      supabase
        .from("members")
        .select(
          "id, name, phone, notes, active, created_at"
        )
        .order("name", { ascending: true }),

      supabase
        .from("accounts")
        .select(
          "id, member_id, meeting_date, status, total, opened_by, closed_at, created_at"
        )
        .order("meeting_date", { ascending: false }),
    ]);

    if (membersResult.error) {
      setError(membersResult.error.message);
      setLoading(false);
      return;
    }

    if (accountsResult.error) {
      setError(accountsResult.error.message);
      setLoading(false);
      return;
    }

    setMembers((membersResult.data ?? []) as Member[]);
    setAccounts((accountsResult.data ?? []) as Account[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return members;

    return members.filter((member) => {
      return (
        member.name.toLowerCase().includes(term) ||
        (member.phone ?? "").toLowerCase().includes(term)
      );
    });
  }, [members, search]);

  const accountsByMember = useMemo(() => {
    const map = new Map<string, Account[]>();

    for (const account of accounts) {
      const current = map.get(account.member_id) ?? [];
      current.push(account);
      map.set(account.member_id, current);
    }

    return map;
  }, [accounts]);

  const stats = useMemo(() => {
    const activeMembers = members.filter(
      (member) => member.active
    ).length;

    const openAccounts = accounts.filter(
      (account) => account.status === "open"
    );

    const pendingMembers = new Set(
      openAccounts.map((account) => account.member_id)
    );

    const pendingTotal = openAccounts.reduce(
      (sum, account) => sum + Number(account.total || 0),
      0
    );

    return {
      activeMembers,
      openAccounts: openAccounts.length,
      pendingMembers: pendingMembers.size,
      pendingTotal,
    };
  }, [members, accounts]);

  function resetMemberForm() {
    setMemberName("");
    setMemberPhone("");
    setMemberNotes("");
  }

  async function handleCreateMember(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setMessage("");
    setError("");

    const name = memberName.trim();

    if (!name) {
      setError("El nombre del miembro es obligatorio.");
      return;
    }

    setSavingMember(true);

    const { error: insertError } = await supabase
      .from("members")
      .insert({
        name,
        phone: memberPhone.trim() || null,
        notes: memberNotes.trim() || null,
        active: true,
      });

    setSavingMember(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    resetMemberForm();
    setShowMemberForm(false);
    setMessage("Miembro creado correctamente.");

    await loadData();
  }

  async function handleOpenAccount() {
    if (!selectedMember) return;

    setOpeningAccount(true);
    setMessage("");
    setError("");

    const { data, error: rpcError } = await supabase.rpc(
      "open_member_account",
      {
        p_member_id: selectedMember.id,
        p_meeting_date: meetingDate,
        p_supervisor_override: supervisorOverride,
      }
    );

    setOpeningAccount(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    if (!data) {
      setError("No se pudo crear la cuenta.");
      return;
    }

    setMessage(
      `Cuenta abierta para ${selectedMember.name}.`
    );

    setSelectedMember(null);
    setSupervisorOverride(false);

    await loadData();
  }

  function getMemberAccounts(memberId: string) {
    return accountsByMember.get(memberId) ?? [];
  }

  function getOpenAccount(memberId: string) {
    return getMemberAccounts(memberId).find(
      (account) => account.status === "open"
    );
  }

  function getPendingCount(memberId: string) {
    return getMemberAccounts(memberId).filter(
      (account) => account.status === "open"
    ).length;
  }

  function canOpenAccount(memberId: string) {
    return !getOpenAccount(memberId);
  }

  /*
   * Abre el detalle de una cuenta.
   *
   * Primero obtenemos los account_items.
   * Después obtenemos los sale_items correspondientes.
   *
   * Lo hacemos en consultas separadas para evitar depender
   * de relaciones anidadas de Supabase que pueden variar
   * según las foreign keys configuradas.
   */
  async function handleOpenAccountDetail(
    account: Account
  ) {
    setError("");
    setMessage("");
    setLoadingAccountDetail(true);

    setSelectedAccount(account);
    setAccountSales([]);

    const { data: accountItemsData, error: accountItemsError } =
      await supabase
        .from("account_items")
        .select("id, account_id, sale_id, created_at")
        .eq("account_id", account.id)
        .order("created_at", {
          ascending: true,
        });

    if (accountItemsError) {
      setLoadingAccountDetail(false);
      setError(
        `No se pudieron cargar las compras de la cuenta: ${accountItemsError.message}`
      );
      return;
    }

    const accountItems =
      (accountItemsData ?? []) as AccountItem[];

    if (accountItems.length === 0) {
      setLoadingAccountDetail(false);
      return;
    }

    const saleIds = accountItems.map(
      (item) => item.sale_id
    );

    const { data: saleItemsData, error: saleItemsError } =
      await supabase
        .from("sale_items")
        .select(
          "id, sale_id, product_name, quantity, unit_price, total"
        )
        .in("sale_id", saleIds)
        .order("created_at", {
          ascending: true,
        });

    if (saleItemsError) {
      setLoadingAccountDetail(false);
      setError(
        `No se pudieron cargar los productos: ${saleItemsError.message}`
      );
      return;
    }

    const saleItems =
      (saleItemsData ?? []) as SaleItem[];

    const salesMap = new Map<string, AccountSale>();

    for (const accountItem of accountItems) {
      salesMap.set(accountItem.sale_id, {
        saleId: accountItem.sale_id,
        createdAt: accountItem.created_at,
        items: [],
        total: 0,
      });
    }

    for (const item of saleItems) {
      const sale = salesMap.get(item.sale_id);

      if (!sale) continue;

      sale.items.push(item);
      sale.total += Number(item.total || 0);
    }

    setAccountSales(
      Array.from(salesMap.values()).sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      )
    );

    setLoadingAccountDetail(false);
  }

  function closeAccountDetail() {
    if (payingAccount) return;

    setSelectedAccount(null);
    setAccountSales([]);
    setPaymentMethod("cash");
    setError("");
  }

  /*
   * Cobra la cuenta completa.
   *
   * La función SQL pay_member_account() se encarga de:
   * - validar usuario
   * - validar cuenta abierta
   * - validar caja abierta
   * - registrar account_payment
   * - cerrar la cuenta
   * - registrar cash_movement
   */
  async function handlePayAccount() {
    if (!selectedAccount) return;

    if (selectedAccount.status !== "open") {
      setError("Esta cuenta ya no está abierta.");
      return;
    }

    if (Number(selectedAccount.total || 0) <= 0) {
      setError("La cuenta no tiene saldo pendiente.");
      return;
    }

    setPayingAccount(true);
    setError("");
    setMessage("");

    const { data, error: rpcError } = await supabase.rpc(
      "pay_member_account",
      {
        p_account_id: selectedAccount.id,
        p_payment_method: paymentMethod,
      }
    );

    setPayingAccount(false);

    if (rpcError) {
      setError(
        `No se pudo cobrar la cuenta: ${rpcError.message}`
      );
      return;
    }

    if (!data) {
      setError("No se recibió confirmación del pago.");
      return;
    }

    const member = members.find(
      (item) => item.id === selectedAccount.member_id
    );

    const memberName = member?.name ?? "el miembro";

    const amount = Number(selectedAccount.total || 0);

    const methodLabel =
      paymentMethod === "cash"
        ? "efectivo"
        : "Nequi";

    setMessage(
      `Cuenta de ${memberName} pagada por ${methodLabel}: ${formatCurrency(
        amount
      )}.`
    );

    setSelectedAccount(null);
    setAccountSales([]);
    setPaymentMethod("cash");

    await loadData();
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Cuentas
          </h1>

          <p className="text-muted-foreground">
            Miembros, cuentas pendientes y pagos
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setError("");
            setMessage("");
            setShowMemberForm(true);
          }}
          className="h-11 rounded-lg bg-primary px-5 font-semibold text-primary-foreground hover:opacity-90"
        >
          + Nuevo miembro
        </button>
      </div>

      {/* MENSAJES */}

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* STATS */}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Miembros activos
          </p>

          <p className="mt-2 text-3xl font-bold">
            {stats.activeMembers}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Cuentas abiertas
          </p>

          <p className="mt-2 text-3xl font-bold">
            {stats.openAccounts}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Miembros con saldo
          </p>

          <p className="mt-2 text-3xl font-bold">
            {stats.pendingMembers}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Saldo pendiente
          </p>

          <p className="mt-2 text-2xl font-bold">
            {formatCurrency(stats.pendingTotal)}
          </p>
        </div>
      </div>

      {/* BUSCADOR */}

      <div className="rounded-xl border bg-card p-4">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar miembro por nombre o teléfono..."
          className="h-12 w-full rounded-lg border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* TABLA */}

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">
                  Miembro
                </th>

                <th className="px-4 py-3 text-left font-semibold">
                  Teléfono
                </th>

                <th className="px-4 py-3 text-left font-semibold">
                  Cuenta actual
                </th>

                <th className="px-4 py-3 text-left font-semibold">
                  Pendientes
                </th>

                <th className="px-4 py-3 text-left font-semibold">
                  Estado
                </th>

                <th className="px-4 py-3 text-right font-semibold">
                  Acción
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Cargando miembros...
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No hay miembros para mostrar.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const openAccount = getOpenAccount(member.id);
                  const pendingCount = getPendingCount(member.id);

                  return (
                    <tr
                      key={member.id}
                      className="border-b last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-4 py-4">
                        <div className="font-semibold">
                          {member.name}
                        </div>

                        {member.notes && (
                          <div className="mt-1 max-w-xs truncate text-xs text-muted-foreground">
                            {member.notes}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {member.phone || "—"}
                      </td>

                      <td className="px-4 py-4">
                        {openAccount ? (
                          <div>
                            <div className="font-semibold">
                              {formatCurrency(
                                Number(openAccount.total || 0)
                              )}
                            </div>

                            <div className="text-xs text-muted-foreground">
                              {formatDate(
                                openAccount.meeting_date
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            Sin cuenta abierta
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={
                            pendingCount >= 2
                              ? "font-bold text-red-600"
                              : pendingCount === 1
                                ? "font-semibold text-orange-600"
                                : "text-muted-foreground"
                          }
                        >
                          {pendingCount}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        {openAccount ? (
                          <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">
                            {getStatusLabel(
                              openAccount.status
                            )}
                          </span>
                        ) : member.active ? (
                          <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                            Inactivo
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-right">
                        {openAccount ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenAccountDetail(
                                openAccount
                              )
                            }
                            className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground hover:opacity-90"
                          >
                            Ver / Cobrar
                          </button>
                        ) : member.active &&
                          canOpenAccount(member.id) ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMember(member);
                              setMeetingDate(getToday());
                              setSupervisorOverride(false);
                              setError("");
                              setMessage("");
                            }}
                            className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground hover:opacity-90"
                          >
                            Abrir cuenta
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No disponible
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL NUEVO MIEMBRO */}

      {showMemberForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  Nuevo miembro
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Registra un miembro de la iglesia.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowMemberForm(false);
                  resetMemberForm();
                }}
                className="rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleCreateMember}
              className="space-y-4"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Nombre *
                </label>

                <input
                  value={memberName}
                  onChange={(event) =>
                    setMemberName(event.target.value)
                  }
                  autoFocus
                  placeholder="Nombre completo"
                  className="h-11 w-full rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Teléfono
                </label>

                <input
                  value={memberPhone}
                  onChange={(event) =>
                    setMemberPhone(event.target.value)
                  }
                  placeholder="300 000 0000"
                  className="h-11 w-full rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Notas
                </label>

                <textarea
                  value={memberNotes}
                  onChange={(event) =>
                    setMemberNotes(event.target.value)
                  }
                  placeholder="Información adicional..."
                  rows={3}
                  className="w-full resize-none rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowMemberForm(false);
                    resetMemberForm();
                  }}
                  className="h-11 flex-1 rounded-lg border font-semibold hover:bg-muted"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={savingMember}
                  className="h-11 flex-1 rounded-lg bg-primary font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {savingMember
                    ? "Guardando..."
                    : "Crear miembro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ABRIR CUENTA */}

      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl">
            <div className="mb-6">
              <p className="text-sm text-muted-foreground">
                Abrir cuenta para
              </p>

              <h2 className="mt-1 text-2xl font-bold">
                {selectedMember.name}
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Fecha de jornada
                </label>

                <input
                  type="date"
                  value={meetingDate}
                  onChange={(event) =>
                    setMeetingDate(event.target.value)
                  }
                  className="h-11 w-full rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {getPendingCount(selectedMember.id) >= 2 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  Este miembro tiene 2 jornadas pendientes.
                  Solo un supervisor puede abrir una nueva cuenta
                  mediante override.
                </div>
              )}

              {getPendingCount(selectedMember.id) >= 2 && (
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                  <input
                    type="checkbox"
                    checked={supervisorOverride}
                    onChange={(event) =>
                      setSupervisorOverride(
                        event.target.checked
                      )
                    }
                    className="mt-1 h-4 w-4"
                  />

                  <div>
                    <div className="font-semibold">
                      Usar override de supervisor
                    </div>

                    <div className="text-xs text-muted-foreground">
                      La base de datos validará que tu usuario
                      realmente tenga rol de supervisor.
                    </div>
                  </div>
                </label>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMember(null);
                    setSupervisorOverride(false);
                  }}
                  className="h-12 flex-1 rounded-lg border font-semibold hover:bg-muted"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleOpenAccount}
                  disabled={
                    openingAccount ||
                    (getPendingCount(selectedMember.id) >= 2 &&
                      !supervisorOverride)
                  }
                  className="h-12 flex-1 rounded-lg bg-primary font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {openingAccount
                    ? "Abriendo..."
                    : "Abrir cuenta"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE / COBRO DE CUENTA */}

      {selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-background shadow-xl">
            {/* HEADER */}

            <div className="border-b p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Cuenta del
                    {" "}
                    {formatDate(
                      selectedAccount.meeting_date
                    )}
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    {members.find(
                      (member) =>
                        member.id ===
                        selectedAccount.member_id
                    )?.name ?? "Miembro"}
                  </h2>

                  <div className="mt-2">
                    <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">
                      {getStatusLabel(selectedAccount.status)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeAccountDetail}
                  disabled={payingAccount}
                  className="rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* CONTENIDO */}

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              {loadingAccountDetail ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Cargando compras...
                </div>
              ) : accountSales.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <div className="text-3xl">🧾</div>

                  <p className="mt-3 font-semibold">
                    Esta cuenta todavía no tiene compras.
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Puedes cerrarla cuando tenga saldo pendiente.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {accountSales.map((sale, index) => (
                    <div
                      key={sale.saleId}
                      className="rounded-xl border"
                    >
                      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                        <div>
                          <div className="text-sm font-semibold">
                            Consumo #{index + 1}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(
                              sale.createdAt
                            )}
                          </div>
                        </div>

                        <div className="font-bold">
                          {formatCurrency(sale.total)}
                        </div>
                      </div>

                      <div className="divide-y">
                        {sale.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-4 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <div className="font-medium">
                                {item.product_name}
                              </div>

                              <div className="text-xs text-muted-foreground">
                                {item.quantity} ×{" "}
                                {formatCurrency(
                                  Number(item.unit_price)
                                )}
                              </div>
                            </div>

                            <div className="shrink-0 font-semibold">
                              {formatCurrency(
                                Number(item.total)
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FOOTER / COBRO */}

            <div className="border-t bg-muted/20 p-6">
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">
                    Saldo pendiente
                  </div>

                  <div className="mt-1 text-3xl font-black">
                    {formatCurrency(
                      Number(selectedAccount.total || 0)
                    )}
                  </div>
                </div>

                <div className="text-right text-xs text-muted-foreground">
                  {accountSales.length} consumo
                  {accountSales.length === 1 ? "" : "s"}
                </div>
              </div>

              {selectedAccount.status === "open" &&
                Number(selectedAccount.total || 0) > 0 && (
                  <>
                    <div className="mb-3 text-sm font-semibold">
                      Método de pago
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setPaymentMethod("cash")
                        }
                        disabled={payingAccount}
                        className={`flex h-14 items-center justify-center gap-2 rounded-xl border-2 font-bold transition ${
                          paymentMethod === "cash"
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:border-primary/50"
                        }`}
                      >
                        <span className="text-xl">💵</span>
                        Efectivo
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setPaymentMethod("nequi")
                        }
                        disabled={payingAccount}
                        className={`flex h-14 items-center justify-center gap-2 rounded-xl border-2 font-bold transition ${
                          paymentMethod === "nequi"
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:border-primary/50"
                        }`}
                      >
                        <span className="text-xl">📱</span>
                        Nequi
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handlePayAccount}
                      disabled={payingAccount}
                      className="h-14 w-full rounded-xl bg-primary text-lg font-black text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {payingAccount
                        ? "REGISTRANDO PAGO..."
                        : `COBRAR ${formatCurrency(
                            Number(selectedAccount.total || 0)
                          )}`}
                    </button>
                  </>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Sale = {
  id: string;
  sale_number: number;
  total: number;
  payment_status: string;
  account_id: string | null;
  created_at: string;
};

type Account = {
  id: string;
  meeting_date: string;
  status: "open" | "paid" | "cancelled";
  total: number;
  created_at: string;
  member_id: string;
};

type Member = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  stock: number;
  min_stock: number;
  active: boolean;
  track_inventory: boolean;
};

type CashRegister = {
  id: string;
  date: string;
  opening_amount: number;
  opened_at: string;
  status: "open" | "closed";
};

type Payment = {
  amount: number;
  method: "cash" | "nequi";
  sale_id: string;
};

const supabase = createClient();

const TIME_ZONE = "America/Bogota";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeZone: TIME_ZONE,
  }).format(new Date(`${value}T12:00:00-05:00`));
}

function getTodayRange() {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const today = formatter.format(now);

  const start = new Date(`${today}T00:00:00-05:00`);
  const end = new Date(`${today}T23:59:59.999-05:00`);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    date: today,
  };
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);

  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cashRegister, setCashRegister] =
    useState<CashRegister | null>(null);

  async function loadDashboard() {
    setLoading(true);

    try {
      const { start, end, date } = getTodayRange();

      const [
        salesResult,
        paymentsResult,
        accountsResult,
        membersResult,
        productsResult,
        cashResult,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select(
            "id,sale_number,total,payment_status,account_id,created_at"
          )
          .eq("status", "completed")
          .gte("created_at", start)
          .lte("created_at", end)
          .order("created_at", { ascending: false }),

        supabase
          .from("payments")
          .select("amount,method,sale_id")
          .gte("created_at", start)
          .lte("created_at", end),

        supabase
          .from("accounts")
          .select(
            "id,meeting_date,status,total,created_at,member_id"
          )
          .eq("status", "open")
          .order("created_at", { ascending: false }),

        supabase
          .from("members")
          .select("id,name"),

        supabase
          .from("products")
          .select(
            "id,name,stock,min_stock,active,track_inventory"
          )
          .eq("active", true)
          .eq("track_inventory", true)
          .order("stock", { ascending: true }),

        supabase
          .from("cash_registers")
          .select("id,date,opening_amount,opened_at,status")
          .eq("status", "open")
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (salesResult.error) throw salesResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (accountsResult.error) throw accountsResult.error;
      if (membersResult.error) throw membersResult.error;
      if (productsResult.error) throw productsResult.error;
      if (cashResult.error) throw cashResult.error;

      setSales((salesResult.data ?? []) as Sale[]);
      setPayments((paymentsResult.data ?? []) as Payment[]);
      setAccounts((accountsResult.data ?? []) as Account[]);
      setMembers((membersResult.data ?? []) as Member[]);
      setProducts((productsResult.data ?? []) as Product[]);
      setCashRegister(
        cashResult.data as CashRegister | null
      );
    } catch (error: any) {
      console.error("ERROR DASHBOARD:", error);
      alert(error?.message ?? "No se pudo cargar el dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const memberMap = useMemo(() => {
    return new Map(members.map((member) => [member.id, member.name]));
  }, [members]);

  const totals = useMemo(() => {
    const totalSales = sales.reduce(
      (sum, sale) => sum + Number(sale.total),
      0
    );

    const transactionCount = sales.length;

    const cash = payments
      .filter((payment) => payment.method === "cash")
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    const nequi = payments
      .filter((payment) => payment.method === "nequi")
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    const pendingAccounts = accounts.reduce(
      (sum, account) => sum + Number(account.total),
      0
    );

    return {
      totalSales,
      transactionCount,
      cash,
      nequi,
      pendingAccounts,
    };
  }, [sales, payments, accounts]);

  const lowStockProducts = useMemo(() => {
    return products.filter(
      (product) =>
        Number(product.stock) <= Number(product.min_stock)
    );
  }, [products]);

  const outOfStockProducts = useMemo(() => {
    return products.filter(
      (product) => Number(product.stock) <= 0
    );
  }, [products]);

  const expectedCash = useMemo(() => {
    if (!cashRegister) return 0;

    const cashFromSales = payments
      .filter((payment) => payment.method === "cash")
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    return Number(cashRegister.opening_amount) + cashFromSales;
  }, [cashRegister, payments]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Cargando dashboard...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Dashboard
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Resumen de la operación de hoy.
          </p>
        </div>

        <button
          onClick={loadDashboard}
          disabled={loading}
          className="h-10 rounded-xl border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          ↻ Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Ventas de hoy
              </p>

              <p className="mt-2 text-2xl font-semibold">
                {formatCurrency(totals.totalSales)}
              </p>
            </div>

            <span className="text-2xl">🛒</span>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {totals.transactionCount}{" "}
            {totals.transactionCount === 1
              ? "transacción"
              : "transacciones"}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Efectivo
              </p>

              <p className="mt-2 text-2xl font-semibold">
                {formatCurrency(totals.cash)}
              </p>
            </div>

            <span className="text-2xl">💵</span>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Cobrado hoy
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Nequi
              </p>

              <p className="mt-2 text-2xl font-semibold">
                {formatCurrency(totals.nequi)}
              </p>
            </div>

            <span className="text-2xl">📱</span>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Cobrado hoy
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Cuentas pendientes
              </p>

              <p className="mt-2 text-2xl font-semibold">
                {formatCurrency(totals.pendingAccounts)}
              </p>
            </div>

            <span className="text-2xl">👤</span>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {accounts.length}{" "}
            {accounts.length === 1
              ? "cuenta abierta"
              : "cuentas abiertas"}
          </p>
        </div>
      </div>

      {/* CAJA + INVENTARIO */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* CAJA */}
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="font-semibold">Caja actual</h2>

              <p className="mt-1 text-xs text-muted-foreground">
                Estado de la jornada actual
              </p>
            </div>

            {cashRegister ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                ● Abierta
              </span>
            ) : (
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                Cerrada
              </span>
            )}
          </div>

          <div className="p-5">
            {cashRegister ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Apertura
                  </span>

                  <span className="font-medium">
                    {formatTime(cashRegister.opened_at)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Saldo inicial
                  </span>

                  <span className="font-medium">
                    {formatCurrency(
                      Number(cashRegister.opening_amount)
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Ventas en efectivo
                  </span>

                  <span className="font-medium">
                    {formatCurrency(totals.cash)}
                  </span>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      Efectivo esperado
                    </span>

                    <span className="text-xl font-bold">
                      {formatCurrency(expectedCash)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="text-4xl">💰</div>

                <p className="mt-3 font-medium">
                  No hay una caja abierta
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Abre una caja para comenzar a registrar ventas.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* INVENTARIO */}
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="font-semibold">
                Inventario
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                Productos que requieren atención
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                outOfStockProducts.length > 0
                  ? "bg-red-100 text-red-700"
                  : lowStockProducts.length > 0
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {outOfStockProducts.length > 0
                ? `${outOfStockProducts.length} agotados`
                : lowStockProducts.length > 0
                  ? `${lowStockProducts.length} bajos`
                  : "Todo bien"}
            </span>
          </div>

          <div className="p-5">
            {lowStockProducts.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-4xl">📦</div>

                <p className="mt-3 font-medium">
                  Inventario saludable
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  No hay productos por debajo del mínimo.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockProducts.slice(0, 6).map((product) => {
                  const out = Number(product.stock) <= 0;

                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between rounded-xl border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {product.name}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          Mínimo: {product.min_stock}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-semibold ${
                          out
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {product.stock}
                      </span>
                    </div>
                  );
                })}

                {lowStockProducts.length > 6 && (
                  <p className="pt-2 text-center text-xs text-muted-foreground">
                    + {lowStockProducts.length - 6} productos más
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ÚLTIMAS VENTAS + CUENTAS */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ÚLTIMAS VENTAS */}
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Últimas ventas</h2>

            <p className="mt-1 text-xs text-muted-foreground">
              Transacciones registradas hoy
            </p>
          </div>

          {sales.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div className="text-4xl">🛒</div>

              <p className="mt-3 font-medium">
                No hay ventas todavía
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Las ventas aparecerán aquí durante la jornada.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {sales.slice(0, 6).map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        Venta #{sale.sale_number}
                      </p>

                      {sale.account_id && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          Cuenta
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatTime(sale.created_at)}
                    </p>
                  </div>

                  <p className="shrink-0 font-semibold">
                    {formatCurrency(Number(sale.total))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CUENTAS */}
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">
              Cuentas abiertas
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              Miembros con saldo pendiente
            </p>
          </div>

          {accounts.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div className="text-4xl">👤</div>

              <p className="mt-3 font-medium">
                No hay cuentas pendientes
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Todos los miembros están al día.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {accounts.slice(0, 6).map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {memberMap.get(account.member_id) ??
                        "Miembro"}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(account.meeting_date)}
                    </p>
                  </div>

                  <p className="shrink-0 font-semibold">
                    {formatCurrency(Number(account.total))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
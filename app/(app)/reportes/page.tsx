"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const COLOMBIA_TIME_ZONE = "America/Bogota";

type Sale = {
  id: string;
  sale_number: number;
  total: number;
  payment_status: string;
  created_by: string;
  created_at: string;
};

type SaleItem = {
  sale_id: string;
  product_name: string;
  quantity: number;
  total: number;
};

type Payment = {
  sale_id: string;
  amount: number;
  method: "cash" | "nequi";
};

type Purchase = {
  id: string;
  total: number;
  created_at: string;
};

type ProductSummary = {
  name: string;
  quantity: number;
  total: number;
};

function getBogotaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: COLOMBIA_TIME_ZONE,
  }).format(new Date());
}

function getDateRange(startDate: string, endDate: string) {
  return {
    start: new Date(`${startDate}T00:00:00-05:00`).toISOString(),
    end: new Date(`${endDate}T23:59:59.999-05:00`).toISOString(),
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeZone: COLOMBIA_TIME_ZONE,
  }).format(new Date(value));
}

export default function ReportesPage() {
  const today = getBogotaDate();

  const firstDayOfMonth = `${today.slice(0, 7)}-01`;

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);

  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReports() {
    setLoading(true);
    setError("");

    const { start, end } = getDateRange(startDate, endDate);

    try {
      const [
        salesResult,
        saleItemsResult,
        paymentsResult,
        purchasesResult,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select(
            "id, sale_number, total, payment_status, created_by, created_at",
          )
          .eq("status", "completed")
          .gte("created_at", start)
          .lte("created_at", end)
          .order("created_at", { ascending: false }),

        supabase
          .from("sale_items")
          .select("sale_id, product_name, quantity, total")
          .gte("created_at", start)
          .lte("created_at", end),

        supabase
          .from("payments")
          .select("sale_id, amount, method")
          .gte("created_at", start)
          .lte("created_at", end),

        supabase
          .from("purchases")
          .select("id, total, created_at")
          .gte("created_at", start)
          .lte("created_at", end)
          .order("created_at", { ascending: false }),
      ]);

      if (salesResult.error) throw salesResult.error;
      if (saleItemsResult.error) throw saleItemsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (purchasesResult.error) throw purchasesResult.error;

      setSales((salesResult.data ?? []) as Sale[]);
      setSaleItems((saleItemsResult.data ?? []) as SaleItem[]);
      setPayments((paymentsResult.data ?? []) as Payment[]);
      setPurchases((purchasesResult.data ?? []) as Purchase[]);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar los reportes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  const saleIds = useMemo(
    () => new Set(sales.map((sale) => sale.id)),
    [sales],
  );

  const filteredPayments = useMemo(
    () => payments.filter((payment) => saleIds.has(payment.sale_id)),
    [payments, saleIds],
  );

  const totalSales = useMemo(
    () => sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
    [sales],
  );

  const totalCash = useMemo(
    () =>
      filteredPayments
        .filter((payment) => payment.method === "cash")
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [filteredPayments],
  );

  const totalNequi = useMemo(
    () =>
      filteredPayments
        .filter((payment) => payment.method === "nequi")
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [filteredPayments],
  );

  const totalPurchases = useMemo(
    () =>
      purchases.reduce(
        (sum, purchase) => sum + Number(purchase.total || 0),
        0,
      ),
    [purchases],
  );

  const pendingAccounts = useMemo(
    () =>
      sales.filter((sale) => sale.payment_status === "pending").reduce(
        (sum, sale) => sum + Number(sale.total || 0),
        0,
      ),
    [sales],
  );

  const estimatedResult = totalSales - totalPurchases;

  const topProducts = useMemo(() => {
    const grouped = new Map<string, ProductSummary>();

    saleItems.forEach((item) => {
      const current = grouped.get(item.product_name);

      if (current) {
        current.quantity += Number(item.quantity || 0);
        current.total += Number(item.total || 0);
      } else {
        grouped.set(item.product_name, {
          name: item.product_name,
          quantity: Number(item.quantity || 0),
          total: Number(item.total || 0),
        });
      }
    });

    return Array.from(grouped.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }, [saleItems]);

  const salesByDay = useMemo(() => {
    const grouped = new Map<string, number>();

    sales.forEach((sale) => {
      const day = new Intl.DateTimeFormat("en-CA", {
        timeZone: COLOMBIA_TIME_ZONE,
      }).format(new Date(sale.created_at));

      grouped.set(day, (grouped.get(day) ?? 0) + Number(sale.total || 0));
    });

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-10);
  }, [sales]);

  function setPreset(preset: "today" | "week" | "month") {
    const now = new Date();

    const todayDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: COLOMBIA_TIME_ZONE,
    }).format(now);

    if (preset === "today") {
      setStartDate(todayDate);
      setEndDate(todayDate);
      return;
    }

    if (preset === "month") {
      setStartDate(`${todayDate.slice(0, 7)}-01`);
      setEndDate(todayDate);
      return;
    }

    const colombiaToday = new Date(`${todayDate}T12:00:00-05:00`);
    colombiaToday.setDate(colombiaToday.getDate() - 6);

    const weekStart = new Intl.DateTimeFormat("en-CA", {
      timeZone: COLOMBIA_TIME_ZONE,
    }).format(colombiaToday);

    setStartDate(weekStart);
    setEndDate(todayDate);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground">
          Resumen de ventas y operación de la cafetería.
        </p>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border bg-background p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Desde
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Hasta
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPreset("today")}
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
            >
              Hoy
            </button>

            <button
              onClick={() => setPreset("week")}
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
            >
              Últimos 7 días
            </button>

            <button
              onClick={() => setPreset("month")}
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
            >
              Este mes
            </button>

            <button
              onClick={loadReports}
              disabled={loading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Cargando..." : "Actualizar"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border bg-background p-5">
          <p className="text-sm text-muted-foreground">Ventas</p>
          <p className="mt-2 text-2xl font-bold">
            {formatCurrency(totalSales)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {sales.length} ventas
          </p>
        </div>

        <div className="rounded-xl border bg-background p-5">
          <p className="text-sm text-muted-foreground">Efectivo</p>
          <p className="mt-2 text-2xl font-bold">
            {formatCurrency(totalCash)}
          </p>
        </div>

        <div className="rounded-xl border bg-background p-5">
          <p className="text-sm text-muted-foreground">Nequi</p>
          <p className="mt-2 text-2xl font-bold">
            {formatCurrency(totalNequi)}
          </p>
        </div>

        <div className="rounded-xl border bg-background p-5">
          <p className="text-sm text-muted-foreground">Compras</p>
          <p className="mt-2 text-2xl font-bold">
            {formatCurrency(totalPurchases)}
          </p>
        </div>

        <div className="rounded-xl border bg-background p-5">
          <p className="text-sm text-muted-foreground">Resultado estimado</p>
          <p className="mt-2 text-2xl font-bold">
            {formatCurrency(estimatedResult)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            ventas − compras
          </p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-background">
          <div className="border-b p-5">
            <h2 className="font-semibold">Resumen de pagos</h2>
          </div>

          <div className="divide-y">
            <div className="flex items-center justify-between p-5">
              <div>
                <p className="font-medium">💵 Efectivo</p>
                <p className="text-sm text-muted-foreground">
                  Ventas pagadas en efectivo
                </p>
              </div>
              <p className="font-semibold">{formatCurrency(totalCash)}</p>
            </div>

            <div className="flex items-center justify-between p-5">
              <div>
                <p className="font-medium">📱 Nequi</p>
                <p className="text-sm text-muted-foreground">
                  Ventas pagadas por Nequi
                </p>
              </div>
              <p className="font-semibold">{formatCurrency(totalNequi)}</p>
            </div>

            <div className="flex items-center justify-between p-5">
              <div>
                <p className="font-medium">👥 Pendiente por cuentas</p>
                <p className="text-sm text-muted-foreground">
                  Ventas registradas a cuenta
                </p>
              </div>
              <p className="font-semibold">
                {formatCurrency(pendingAccounts)}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-background">
          <div className="border-b p-5">
            <h2 className="font-semibold">Ventas por día</h2>
          </div>

          <div className="p-5">
            {salesByDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay ventas en este período.
              </p>
            ) : (
              <div className="space-y-3">
                {salesByDay.map(([day, amount]) => (
                  <div
                    key={day}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-sm">
                      {new Intl.DateTimeFormat("es-CO", {
                        dateStyle: "medium",
                        timeZone: COLOMBIA_TIME_ZONE,
                      }).format(new Date(`${day}T12:00:00-05:00`))}
                    </span>

                    <span className="font-semibold">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Productos */}
      <section className="rounded-xl border bg-background">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="font-semibold">Productos más vendidos</h2>
            <p className="text-sm text-muted-foreground">
              Ordenados por unidades vendidas.
            </p>
          </div>
        </div>

        {topProducts.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No hay productos vendidos en este período.
          </div>
        ) : (
          <div className="divide-y">
            {topProducts.map((product, index) => (
              <div
                key={product.name}
                className="flex items-center gap-4 p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
                  {index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {product.quantity} unidades
                  </p>
                </div>

                <p className="font-semibold">
                  {formatCurrency(product.total)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Compras */}
      <section className="rounded-xl border bg-background">
        <div className="border-b p-5">
          <h2 className="font-semibold">Compras del período</h2>
          <p className="text-sm text-muted-foreground">
            {purchases.length} compras registradas.
          </p>
        </div>

        {purchases.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No hay compras en este período.
          </div>
        ) : (
          <div className="divide-y">
            {purchases.slice(0, 10).map((purchase) => (
              <div
                key={purchase.id}
                className="flex items-center justify-between p-4"
              >
                <div>
                  <p className="font-medium">
                    Compra #{purchase.id.slice(0, 8)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(purchase.created_at)}
                  </p>
                </div>

                <p className="font-semibold">
                  {formatCurrency(Number(purchase.total || 0))}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground">
        <strong>Nota:</strong> el resultado estimado corresponde a ventas
        menos compras registradas. No representa todavía la utilidad neta
        real, porque aún no estamos descontando el costo de cada producto,
        gastos operativos ni otros movimientos de caja.
      </div>
    </div>
  );
}
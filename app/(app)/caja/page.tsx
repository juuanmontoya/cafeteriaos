"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CashRegister = {
  id: string;
  date: string;
  opening_amount: number;
  opened_at: string;
  status: "open" | "closed";
};

type CashMovement = {
  id: string;
  type: "opening" | "sale" | "expense" | "adjustment";
  amount: number;
  concept: string | null;
  created_at: string;
};

type Closure = {
  id: string;
  expected_amount: number;
  counted_amount: number;
  difference: number;
  notes: string | null;
  created_at: string;
};

type PaymentRow = {
  amount: number;
  method: "cash" | "nequi";
  created_at: string;
};

const supabase = createClient();

const COLOMBIA_TIME_ZONE = "America/Bogota";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: COLOMBIA_TIME_ZONE,
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeZone: COLOMBIA_TIME_ZONE,
  }).format(new Date(`${value}T12:00:00-05:00`));
}

export default function CajaPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [register, setRegister] = useState<CashRegister | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [accountPayments, setAccountPayments] = useState<PaymentRow[]>([]);
  const [lastClosure, setLastClosure] = useState<Closure | null>(null);

  const [openingAmount, setOpeningAmount] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseConcept, setExpenseConcept] = useState("");

  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentConcept, setAdjustmentConcept] = useState("");

  const [countedCash, setCountedCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);

  async function loadCaja() {
    setLoading(true);

    try {
      const { data: registerData, error: registerError } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (registerError) {
        throw registerError;
      }

      if (!registerData) {
        setRegister(null);
        setMovements([]);
        setPayments([]);
        setAccountPayments([]);
        setLoading(false);
        return;
      }

      const currentRegister = registerData as CashRegister;

      setRegister(currentRegister);

      const [
        { data: movementsData, error: movementsError },
        { data: paymentsData, error: paymentsError },
        { data: accountPaymentsData, error: accountPaymentsError },
      ] = await Promise.all([
        supabase
          .from("cash_movements")
          .select("id,type,amount,concept,created_at")
          .eq("cash_register_id", currentRegister.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("payments")
          .select("amount,method,created_at")
          .gte("created_at", currentRegister.opened_at)
          .order("created_at", { ascending: false }),

        supabase
          .from("account_payments")
          .select("amount,method,created_at")
          .gte("created_at", currentRegister.opened_at)
          .order("created_at", { ascending: false }),
      ]);

      if (movementsError) throw movementsError;
      if (paymentsError) throw paymentsError;
      if (accountPaymentsError) throw accountPaymentsError;

      setMovements((movementsData ?? []) as CashMovement[]);
      setPayments((paymentsData ?? []) as PaymentRow[]);
      setAccountPayments((accountPaymentsData ?? []) as PaymentRow[]);
    } catch (error: any) {
      console.error(error);
      alert(error?.message ?? "No se pudo cargar la caja.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCaja();
  }, []);

  const totals = useMemo(() => {
    if (!register) {
      return {
        cashSales: 0,
        nequiSales: 0,
        cashAccountPayments: 0,
        nequiAccountPayments: 0,
        cashIncome: 0,
        nequiIncome: 0,
        expenses: 0,
        adjustments: 0,
        expectedCash: 0,
        totalIncome: 0,
      };
    }

    const cashSales = payments
      .filter((payment) => payment.method === "cash")
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    const nequiSales = payments
      .filter((payment) => payment.method === "nequi")
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    const cashAccountPayments = accountPayments
      .filter((payment) => payment.method === "cash")
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    const nequiAccountPayments = accountPayments
      .filter((payment) => payment.method === "nequi")
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    const expenses = movements
      .filter((movement) => movement.type === "expense")
      .reduce((sum, movement) => sum + Number(movement.amount), 0);

    const adjustments = movements
      .filter((movement) => movement.type === "adjustment")
      .reduce((sum, movement) => sum + Number(movement.amount), 0);

    const cashIncome = cashSales + cashAccountPayments;
    const nequiIncome = nequiSales + nequiAccountPayments;

    const expectedCash =
      Number(register.opening_amount) +
      cashIncome -
      expenses +
      adjustments;

    return {
      cashSales,
      nequiSales,
      cashAccountPayments,
      nequiAccountPayments,
      cashIncome,
      nequiIncome,
      expenses,
      adjustments,
      expectedCash,
      totalIncome: cashIncome + nequiIncome,
    };
  }, [register, payments, accountPayments, movements]);

  async function openCaja() {
    const amount = Number(openingAmount);

    if (Number.isNaN(amount) || amount < 0) {
      alert("Ingresa un monto inicial válido.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.rpc("open_cash_register", {
        p_opening_amount: amount,
      });

      if (error) {
        throw error;
      }

      setOpeningAmount("");
      await loadCaja();
    } catch (error: any) {
      console.error("ERROR AL ABRIR CAJA:", error);
      alert(error?.message ?? "No se pudo abrir la caja.");
    } finally {
      setSaving(false);
    }
  }

  async function addExpense() {
    const amount = Number(expenseAmount);

    if (Number.isNaN(amount) || amount <= 0) {
      alert("Ingresa un valor válido para el gasto.");
      return;
    }

    if (!expenseConcept.trim()) {
      alert("Escribe el concepto del gasto.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.rpc("add_cash_expense", {
        p_amount: amount,
        p_concept: expenseConcept.trim(),
      });

      if (error) {
        throw error;
      }

      setExpenseAmount("");
      setExpenseConcept("");
      setShowExpenseForm(false);

      await loadCaja();
    } catch (error: any) {
      console.error(error);
      alert(error?.message ?? "No se pudo registrar el gasto.");
    } finally {
      setSaving(false);
    }
  }

  async function addAdjustment() {
    const amount = Number(adjustmentAmount);

    if (Number.isNaN(amount) || amount === 0) {
      alert("Ingresa un ajuste diferente de cero.");
      return;
    }

    if (!adjustmentConcept.trim()) {
      alert("Escribe el concepto del ajuste.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.rpc("add_cash_adjustment", {
        p_amount: amount,
        p_concept: adjustmentConcept.trim(),
      });

      if (error) {
        throw error;
      }

      setAdjustmentAmount("");
      setAdjustmentConcept("");
      setShowAdjustmentForm(false);

      await loadCaja();
    } catch (error: any) {
      console.error(error);
      alert(error?.message ?? "No se pudo registrar el ajuste.");
    } finally {
      setSaving(false);
    }
  }

  async function closeCaja() {
    const amount = Number(countedCash);

    if (Number.isNaN(amount) || amount < 0) {
      alert("Ingresa el efectivo contado.");
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase.rpc("close_cash_register", {
        p_actual_cash: amount,
        p_notes: closeNotes.trim() || null,
      });

      if (error) {
        throw error;
      }

      setLastClosure(data as Closure);
      setCountedCash("");
      setCloseNotes("");
      setShowCloseForm(false);

      await loadCaja();
    } catch (error: any) {
      console.error(error);
      alert(error?.message ?? "No se pudo cerrar la caja.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando caja...</p>
      </div>
    );
  }

  if (!register) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Caja</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Abre la caja para comenzar la jornada.
          </p>
        </div>

        <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-6">
            <div className="mb-2 text-4xl">💰</div>
            <h2 className="text-lg font-semibold">Abrir caja</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Registra cuánto efectivo hay físicamente al comenzar.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Efectivo inicial
            </label>

            <input
              type="number"
              min="0"
              value={openingAmount}
              onChange={(e) => setOpeningAmount(e.target.value)}
              placeholder="0"
              className="h-12 w-full rounded-xl border bg-background px-4 text-lg outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            onClick={openCaja}
            disabled={saving}
            className="mt-5 h-12 w-full rounded-xl bg-primary px-4 font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Abriendo..." : "Abrir caja"}
          </button>
        </div>
      </div>
    );
  }

  const differencePreview =
    countedCash === ""
      ? null
      : Number(countedCash) - totals.expectedCash;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Caja</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Caja abierta · {formatDate(register.date)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Abierta: {formatDateTime(register.opened_at)}
          </p>
        </div>

        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
          ● Abierta
        </span>
      </div>

      {/* RESUMEN */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Efectivo esperado</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatCurrency(totals.expectedCash)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Lo que debería haber físicamente
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Nequi</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatCurrency(totals.nequiIncome)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ventas + pagos de cuentas
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Ingresos</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatCurrency(totals.totalIncome)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Efectivo + Nequi
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Gastos</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatCurrency(totals.expenses)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Salidas registradas
          </p>
        </div>
      </div>

      {/* DETALLE */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* DESGLOSE */}
          <div className="rounded-2xl border bg-card shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">Resumen de la jornada</h2>
            </div>

            <div className="divide-y">
              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-sm">Saldo inicial</span>
                <span className="font-medium">
                  {formatCurrency(register.opening_amount)}
                </span>
              </div>

              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-sm">Ventas en efectivo</span>
                <span className="font-medium">
                  {formatCurrency(totals.cashSales)}
                </span>
              </div>

              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-sm">Pagos de cuentas en efectivo</span>
                <span className="font-medium">
                  {formatCurrency(totals.cashAccountPayments)}
                </span>
              </div>

              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-sm">Ventas en Nequi</span>
                <span className="font-medium">
                  {formatCurrency(totals.nequiSales)}
                </span>
              </div>

              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-sm">Pagos de cuentas en Nequi</span>
                <span className="font-medium">
                  {formatCurrency(totals.nequiAccountPayments)}
                </span>
              </div>

              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-sm">Gastos</span>
                <span className="font-medium text-red-600">
                  - {formatCurrency(totals.expenses)}
                </span>
              </div>

              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-sm">Ajustes</span>
                <span className="font-medium">
                  {formatCurrency(totals.adjustments)}
                </span>
              </div>

              <div className="flex items-center justify-between bg-muted/40 px-5 py-5">
                <span className="font-semibold">Efectivo esperado</span>
                <span className="text-xl font-bold">
                  {formatCurrency(totals.expectedCash)}
                </span>
              </div>
            </div>
          </div>

          {/* MOVIMIENTOS */}
          <div className="rounded-2xl border bg-card shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">Movimientos de caja</h2>
            </div>

            {movements.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                No hay movimientos adicionales registrados.
              </div>
            ) : (
              <div className="divide-y">
                {movements.map((movement) => {
                  const isExpense = movement.type === "expense";
                  const isAdjustment = movement.type === "adjustment";

                  return (
                    <div
                      key={movement.id}
                      className="flex items-center justify-between gap-4 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {movement.concept || "Movimiento de caja"}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(movement.created_at)}
                        </p>
                      </div>

                      <div
                        className={`shrink-0 font-medium ${
                          isExpense
                            ? "text-red-600"
                            : isAdjustment
                              ? movement.amount >= 0
                                ? "text-emerald-600"
                                : "text-red-600"
                              : ""
                        }`}
                      >
                        {isExpense
                          ? `- ${formatCurrency(movement.amount)}`
                          : formatCurrency(movement.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ACCIONES */}
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Acciones</h2>

            <div className="mt-4 space-y-2">
              <button
                onClick={() => setShowExpenseForm((value) => !value)}
                className="h-11 w-full rounded-xl border px-4 text-sm font-medium hover:bg-muted"
              >
                Registrar gasto
              </button>

              <button
                onClick={() => setShowAdjustmentForm((value) => !value)}
                className="h-11 w-full rounded-xl border px-4 text-sm font-medium hover:bg-muted"
              >
                Registrar ajuste
              </button>

              <button
                onClick={() => setShowCloseForm((value) => !value)}
                className="h-11 w-full rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Cerrar caja
              </button>
            </div>
          </div>

          {/* GASTO */}
          {showExpenseForm && (
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <h3 className="font-semibold">Registrar gasto</h3>

              <div className="mt-4 space-y-3">
                <input
                  type="number"
                  min="0"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="Valor"
                  className="h-11 w-full rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring"
                />

                <input
                  type="text"
                  value={expenseConcept}
                  onChange={(e) => setExpenseConcept(e.target.value)}
                  placeholder="Concepto"
                  className="h-11 w-full rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring"
                />

                <div className="flex gap-2">
                  <button
                    onClick={addExpense}
                    disabled={saving}
                    className="h-10 flex-1 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>

                  <button
                    onClick={() => setShowExpenseForm(false)}
                    className="h-10 rounded-xl border px-4 text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AJUSTE */}
          {showAdjustmentForm && (
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <h3 className="font-semibold">Registrar ajuste</h3>

              <p className="mt-1 text-xs text-muted-foreground">
                Usa un valor positivo para sumar efectivo o negativo para
                restarlo.
              </p>

              <div className="mt-4 space-y-3">
                <input
                  type="number"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  placeholder="Ej: 5000 o -5000"
                  className="h-11 w-full rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring"
                />

                <input
                  type="text"
                  value={adjustmentConcept}
                  onChange={(e) => setAdjustmentConcept(e.target.value)}
                  placeholder="Concepto"
                  className="h-11 w-full rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring"
                />

                <div className="flex gap-2">
                  <button
                    onClick={addAdjustment}
                    disabled={saving}
                    className="h-10 flex-1 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>

                  <button
                    onClick={() => setShowAdjustmentForm(false)}
                    className="h-10 rounded-xl border px-4 text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CIERRE */}
          {showCloseForm && (
            <div className="rounded-2xl border border-primary/30 bg-card p-5 shadow-sm">
              <h3 className="font-semibold">Cerrar caja</h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Cuenta físicamente el efectivo y registra el valor real.
              </p>

              <div className="mt-4 rounded-xl bg-muted/50 p-4">
                <div className="flex justify-between text-sm">
                  <span>Efectivo esperado</span>
                  <strong>{formatCurrency(totals.expectedCash)}</strong>
                </div>

                {differencePreview !== null && (
                  <div className="mt-3 flex justify-between border-t pt-3 text-sm">
                    <span>Diferencia</span>

                    <strong
                      className={
                        differencePreview === 0
                          ? "text-emerald-600"
                          : differencePreview > 0
                            ? "text-blue-600"
                            : "text-red-600"
                      }
                    >
                      {differencePreview > 0 ? "+" : ""}
                      {formatCurrency(differencePreview)}
                    </strong>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-3">
                <input
                  type="number"
                  min="0"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  placeholder="Efectivo contado"
                  className="h-12 w-full rounded-xl border bg-background px-4 text-lg outline-none focus:ring-2 focus:ring-ring"
                />

                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Notas del cierre (opcional)"
                  rows={3}
                  className="w-full resize-none rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />

                <button
                  onClick={closeCaja}
                  disabled={saving}
                  className="h-11 w-full rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {saving ? "Cerrando..." : "Confirmar cierre"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RESULTADO DEL CIERRE */}
      {lastClosure && !register && (
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Caja cerrada</h2>

          <p className="mt-1 text-xs text-muted-foreground">
            Cerrada: {formatDateTime(lastClosure.created_at)}
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Esperado</p>
              <p className="mt-1 font-semibold">
                {formatCurrency(lastClosure.expected_amount)}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Contado</p>
              <p className="mt-1 font-semibold">
                {formatCurrency(lastClosure.counted_amount)}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Diferencia</p>
              <p
                className={`mt-1 font-semibold ${
                  lastClosure.difference === 0
                    ? "text-emerald-600"
                    : lastClosure.difference > 0
                      ? "text-blue-600"
                      : "text-red-600"
                }`}
              >
                {lastClosure.difference > 0 ? "+" : ""}
                {formatCurrency(lastClosure.difference)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
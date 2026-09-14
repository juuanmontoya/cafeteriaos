export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Dashboard
        </h1>

        <p className="text-muted-foreground">
          Resumen de la operación de la cafetería.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-background p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Ventas de hoy
          </p>

          <p className="mt-2 text-2xl font-bold">
            $0
          </p>
        </div>

        <div className="rounded-xl border bg-background p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Transacciones
          </p>

          <p className="mt-2 text-2xl font-bold">
            0
          </p>
        </div>

        <div className="rounded-xl border bg-background p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Efectivo
          </p>

          <p className="mt-2 text-2xl font-bold">
            $0
          </p>
        </div>

        <div className="rounded-xl border bg-background p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Nequi
          </p>

          <p className="mt-2 text-2xl font-bold">
            $0
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-background p-6 shadow-sm">
          <h2 className="font-semibold">
            Productos con stock bajo
          </h2>

          <p className="mt-4 text-sm text-muted-foreground">
            No hay productos para mostrar todavía.
          </p>
        </div>

        <div className="rounded-xl border bg-background p-6 shadow-sm">
          <h2 className="font-semibold">
            Cuentas pendientes
          </h2>

          <p className="mt-4 text-sm text-muted-foreground">
            No hay cuentas pendientes.
          </p>
        </div>
      </div>
    </div>
  );
}
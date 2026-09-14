import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const navigation = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "🏠",
  },
  {
    label: "Ventas",
    href: "/ventas",
    icon: "🛒",
  },
  {
    label: "Cuentas",
    href: "/cuentas",
    icon: "👥",
  },
  {
    label: "Inventario",
    href: "/inventario",
    icon: "📦",
  },
  {
    label: "Productos",
    href: "/productos",
    icon: "🥤",
  },
  {
    label: "Compras",
    href: "/compras",
    icon: "🛍️",
  },
  {
    label: "Caja",
    href: "/caja",
    icon: "💰",
  },
  {
    label: "Reportes",
    href: "/reportes",
    icon: "📊",
  },
];

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("name, role")
      .eq("id", user.id)
      .single();

    profile = data;
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-background md:flex md:flex-col">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="text-2xl">☕</span>

            <div>
              <p className="font-bold leading-none">CafeteríaOS</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Administración
              </p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t p-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="truncate text-sm font-medium">
              {profile?.name ?? "Usuario"}
            </p>

            <p className="mt-1 text-xs capitalize text-muted-foreground">
              {profile?.role ?? "usuario"}
            </p>
          </div>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur">
          <div>
            <p className="text-sm text-muted-foreground">
              Cafetería
            </p>

            <h1 className="font-semibold">
              Administración
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">
                {profile?.name ?? "Usuario"}
              </p>

              <p className="text-xs capitalize text-muted-foreground">
                {profile?.role ?? "usuario"}
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {profile?.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
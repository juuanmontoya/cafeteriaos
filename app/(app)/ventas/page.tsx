"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  barcode: string | null;
  sale_price: number;
  stock: number;
  track_inventory: boolean;
  active: boolean;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type Member = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
};

type PaymentMode = "cash" | "nequi" | "account";

const COLOMBIA_TIME_ZONE = "America/Bogota";

export default function VentasPage() {
  const supabase = createClient();

  const searchRef = useRef<HTMLInputElement>(null);
  const memberSearchRef = useRef<HTMLInputElement>(null);

  const scannerBufferRef = useRef("");
  const scannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyTimeRef = useRef(0);

  const [products, setProducts] = useState<Product[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [search, setSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  const [paymentMode, setPaymentMode] =
    useState<PaymentMode>("cash");

  const [selectedMember, setSelectedMember] =
    useState<Member | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadProducts() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, barcode, sale_price, stock, track_inventory, active",
      )
      .eq("active", true)
      .order("name");

    if (error) {
      setError(`Error cargando productos: ${error.message}`);
      setLoading(false);
      return;
    }

    setProducts(data ?? []);
    setLoading(false);
  }

  async function loadMembers() {
    setLoadingMembers(true);

    const { data, error } = await supabase
      .from("members")
      .select("id, name, phone, active")
      .eq("active", true)
      .order("name");

    if (error) {
      setError(`Error cargando miembros: ${error.message}`);
      setLoadingMembers(false);
      return;
    }

    setMembers(data ?? []);
    setLoadingMembers(false);
  }

  useEffect(() => {
    loadProducts();

    const timer = window.setTimeout(() => {
      searchRef.current?.focus();
    }, 100);

    return () => {
      window.clearTimeout(timer);

      if (scannerTimerRef.current) {
        clearTimeout(scannerTimerRef.current);
      }
    };
  }, []);

  const barcodeMap = useMemo(() => {
    const map = new Map<string, Product>();

    for (const product of products) {
      if (!product.barcode) continue;

      const barcode = product.barcode.trim().toLowerCase();

      if (barcode) {
        map.set(barcode, product);
      }
    }

    return map;
  }, [products]);

  const nameMap = useMemo(() => {
    const map = new Map<string, Product>();

    for (const product of products) {
      map.set(product.name.trim().toLowerCase(), product);
    }

    return map;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return products;
    }

    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(query) ||
        (product.barcode ?? "").toLowerCase().includes(query)
      );
    });
  }, [products, search]);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();

    if (!query) {
      return members.slice(0, 20);
    }

    return members
      .filter((member) => {
        return (
          member.name.toLowerCase().includes(query) ||
          (member.phone ?? "").toLowerCase().includes(query)
        );
      })
      .slice(0, 20);
  }, [members, memberSearch]);

  const total = useMemo(() => {
    return cart.reduce(
      (sum, item) =>
        sum +
        Number(item.product.sale_price) * item.quantity,
      0,
    );
  }, [cart]);

  function focusScanner() {
    window.setTimeout(() => {
      searchRef.current?.focus();
    }, 0);
  }

  function findProduct(value: string) {
    const cleanValue = value.trim().toLowerCase();

    if (!cleanValue) {
      return null;
    }

    const barcodeMatch = barcodeMap.get(cleanValue);

    if (barcodeMatch) {
      return barcodeMatch;
    }

    return nameMap.get(cleanValue) ?? null;
  }

  function addToCart(product: Product) {
    setError("");
    setMessage("");

    if (product.track_inventory && product.stock <= 0) {
      setError(`"${product.name}" está agotado.`);
      setSearch("");
      focusScanner();
      return;
    }

    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) => item.product.id === product.id,
      );

      if (!existing) {
        return [
          ...currentCart,
          {
            product,
            quantity: 1,
          },
        ];
      }

      const newQuantity = existing.quantity + 1;

      if (
        product.track_inventory &&
        newQuantity > Number(product.stock)
      ) {
        setError(
          `No puedes agregar más "${product.name}". Stock disponible: ${product.stock}.`,
        );

        return currentCart;
      }

      return currentCart.map((item) =>
        item.product.id === product.id
          ? {
              ...item,
              quantity: newQuantity,
            }
          : item,
      );
    });

    setSearch("");
    scannerBufferRef.current = "";

    focusScanner();
  }

  function processScannedCode(code: string) {
    const cleanCode = code.trim();

    if (!cleanCode) {
      return;
    }

    const product = findProduct(cleanCode);

    if (product) {
      addToCart(product);
      return;
    }

    setError(
      `No encontramos ningún producto para "${cleanCode}".`,
    );

    setSearch("");
    scannerBufferRef.current = "";

    focusScanner();
  }

  function handleScannerKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();

      const value = search.trim();

      if (value) {
        processScannedCode(value);
      }

      return;
    }

    if (event.key.length !== 1) {
      return;
    }

    const now = performance.now();
    const elapsed = now - lastKeyTimeRef.current;

    lastKeyTimeRef.current = now;

    if (elapsed > 80) {
      scannerBufferRef.current = "";
    }

    scannerBufferRef.current += event.key;

    if (scannerTimerRef.current) {
      clearTimeout(scannerTimerRef.current);
    }

    scannerTimerRef.current = setTimeout(() => {
      const code = scannerBufferRef.current.trim();

      scannerBufferRef.current = "";

      if (!code || code.length < 6) {
        return;
      }

      const product = findProduct(code);

      if (product) {
        addToCart(product);
      }
    }, 60);
  }

  function handleManualSearchKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    const value = search.trim();

    if (!value) {
      return;
    }

    const exactProduct = findProduct(value);

    if (exactProduct) {
      addToCart(exactProduct);
      return;
    }

    const query = value.toLowerCase();

    const matchingProducts = products.filter((product) => {
      return (
        product.name.toLowerCase().includes(query) ||
        (product.barcode ?? "").toLowerCase().includes(query)
      );
    });

    if (matchingProducts.length === 1) {
      addToCart(matchingProducts[0]);
      return;
    }

    if (matchingProducts.length === 0) {
      setError(
        `No encontramos ningún producto para "${value}".`,
      );
    }
  }

  function updateQuantity(
    productId: string,
    quantity: number,
  ) {
    const product = products.find(
      (item) => item.id === productId,
    );

    if (!product) {
      return;
    }

    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    if (
      product.track_inventory &&
      quantity > Number(product.stock)
    ) {
      setError(
        `Stock insuficiente para "${product.name}". Disponible: ${product.stock}.`,
      );
      return;
    }

    setError("");

    setCart((currentCart) =>
      currentCart.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              quantity,
            }
          : item,
      ),
    );
  }

  function removeFromCart(productId: string) {
    setCart((currentCart) =>
      currentCart.filter(
        (item) => item.product.id !== productId,
      ),
    );

    focusScanner();
  }

  function clearCart() {
    setCart([]);
    setError("");
    setMessage("");
    setSearch("");

    scannerBufferRef.current = "";

    setPaymentMode("cash");
    setSelectedMember(null);
    setMemberSearch("");

    focusScanner();
  }

  function selectCash() {
    setPaymentMode("cash");
    setSelectedMember(null);
    setMemberSearch("");
    setError("");
    setMessage("");

    focusScanner();
  }

  function selectNequi() {
    setPaymentMode("nequi");
    setSelectedMember(null);
    setMemberSearch("");
    setError("");
    setMessage("");

    focusScanner();
  }

  async function selectAccountMode() {
    setPaymentMode("account");
    setSelectedMember(null);
    setMemberSearch("");
    setError("");
    setMessage("");

    if (members.length === 0) {
      await loadMembers();
    }

    window.setTimeout(() => {
      memberSearchRef.current?.focus();
    }, 50);
  }

  function selectMember(member: Member) {
    setSelectedMember(member);
    setMemberSearch("");
    setError("");
    setMessage("");

    focusScanner();
  }

  function cancelAccountMode() {
    setPaymentMode("cash");
    setSelectedMember(null);
    setMemberSearch("");
    setError("");
    setMessage("");

    focusScanner();
  }

  function getTodayInBogota() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: COLOMBIA_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  async function openAccountForMember(): Promise<string | null> {
    if (!selectedMember) {
      setError("Selecciona un miembro.");
      return null;
    }

    setError("");

    const meetingDate = getTodayInBogota();

    const { data, error } = await supabase.rpc(
      "open_member_account",
      {
        p_member_id: selectedMember.id,
        p_meeting_date: meetingDate,
        p_supervisor_override: false,
      },
    );

    if (error) {
      setError(error.message);
      return null;
    }

    if (!data?.id) {
      setError("No se pudo abrir la cuenta.");
      return null;
    }

    return data.id;
  }

  async function findOrCreateAccount(): Promise<string | null> {
    if (!selectedMember) {
      setError("Selecciona un miembro.");
      return null;
    }

    /*
     * IMPORTANTE:
     * Solo buscamos la cuenta abierta de HOY.
     *
     * Así una cuenta del miércoles no recibe
     * accidentalmente las compras del viernes.
     */
    const today = getTodayInBogota();

    const { data, error } = await supabase
      .from("accounts")
      .select("id, meeting_date, status")
      .eq("member_id", selectedMember.id)
      .eq("meeting_date", today)
      .eq("status", "open")
      .limit(1);

    if (error) {
      setError(
        `No se pudo consultar la cuenta: ${error.message}`,
      );
      return null;
    }

    if (data?.[0]?.id) {
      return data[0].id;
    }

    return await openAccountForMember();
  }

  async function completeSale() {
    setError("");
    setMessage("");

    if (cart.length === 0) {
      setError("Agrega al menos un producto.");
      focusScanner();
      return;
    }

    if (
      paymentMode === "account" &&
      !selectedMember
    ) {
      setError(
        "Selecciona un miembro para cobrar a cuenta.",
      );
      return;
    }

    setSaving(true);

    let accountId: string | null = null;

    if (paymentMode === "account") {
      accountId = await findOrCreateAccount();

      if (!accountId) {
        setSaving(false);
        focusScanner();
        return;
      }
    }

    const items = cart.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity,
    }));

    const { data, error } = await supabase.rpc(
      "create_sale",
      {
        p_items: items,
        p_payment_method:
          paymentMode === "account"
            ? null
            : paymentMode,
        p_member_id:
          paymentMode === "account"
            ? selectedMember?.id ?? null
            : null,
        p_account_id: accountId,
      },
    );

    if (error) {
      setError(
        `No se pudo completar la venta: ${error.message}`,
      );
      setSaving(false);
      focusScanner();
      return;
    }

    /*
     * Actualizamos el stock local para que la pantalla
     * refleje inmediatamente la venta.
     */
    setProducts((currentProducts) =>
      currentProducts.map((product) => {
        const soldItem = cart.find(
          (item) => item.product.id === product.id,
        );

        if (!soldItem || !product.track_inventory) {
          return product;
        }

        return {
          ...product,
          stock: Math.max(
            0,
            Number(product.stock) - soldItem.quantity,
          ),
        };
      }),
    );

    const saleTotal = Number(data.total);
    const saleNumber = data.sale_number;
    const memberName = selectedMember?.name;

    setCart([]);
    setSearch("");

    scannerBufferRef.current = "";

    if (paymentMode === "account") {
      setMessage(
        `Venta #${saleNumber} agregada a la cuenta de ${memberName} por $${saleTotal.toLocaleString(
          "es-CO",
        )}.`,
      );
    } else {
      const paymentLabel =
        paymentMode === "cash"
          ? "Efectivo"
          : "Nequi";

      setMessage(
        `Venta #${saleNumber} registrada en ${paymentLabel} por $${saleTotal.toLocaleString(
          "es-CO",
        )}.`,
      );
    }

    /*
     * La siguiente venta comienza siempre como
     * venta normal en efectivo.
     */
    setPaymentMode("cash");
    setSelectedMember(null);
    setMemberSearch("");

    setSaving(false);

    focusScanner();
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-80px)] flex-col gap-4">
      {/* ENCABEZADO */}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Ventas
        </h1>

        <p className="text-sm text-muted-foreground">
          Registra ventas, escanea productos y cobra
          rápidamente.
        </p>
      </div>

      {/* MENSAJES */}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {/* CONTENIDO */}

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_420px]">
        {/* PRODUCTOS */}

        <div className="flex min-h-0 flex-col rounded-xl border bg-card">
          <div className="border-b p-4">
            <div className="relative">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleManualSearchKeyDown(event);
                    return;
                  }

                  handleScannerKeyDown(event);
                }}
                placeholder="Escanea un código de barras o busca un producto..."
                className="h-12 w-full rounded-lg border bg-background px-4 pr-12 text-base outline-none transition focus:ring-2 focus:ring-primary"
                disabled={loading || saving}
                autoComplete="off"
                autoFocus
              />

              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg">
                🔎
              </div>
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              Escanea directamente. También puedes buscar
              por nombre.
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Cargando productos...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No encontramos productos.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {filteredProducts.map((product) => {
                  const unavailable =
                    product.track_inventory &&
                    product.stock <= 0;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={unavailable || saving}
                      onClick={() =>
                        addToCart(product)
                      }
                      className="flex min-h-[125px] flex-col justify-between rounded-xl border bg-background p-4 text-left transition hover:border-primary hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div>
                        <div className="font-medium leading-tight">
                          {product.name}
                        </div>

                        {product.barcode && (
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {product.barcode}
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        <div className="text-lg font-bold">
                          $
                          {Number(
                            product.sale_price,
                          ).toLocaleString("es-CO")}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {product.track_inventory
                            ? unavailable
                              ? "Agotado"
                              : `Stock: ${product.stock}`
                            : "Sin control de stock"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* CARRITO */}

        <div className="flex min-h-0 flex-col rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b p-4">
            <div>
              <h2 className="font-semibold">
                Venta actual
              </h2>

              <p className="text-xs text-muted-foreground">
                {cart.length} producto
                {cart.length === 1 ? "" : "s"}
              </p>
            </div>

            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                disabled={saving}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Vaciar
              </button>
            )}
          </div>

          {/* CUENTA */}

          {paymentMode === "account" && (
            <div className="border-b bg-muted/20 p-4">
              {selectedMember ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Venta a cuenta
                    </div>

                    <div className="truncate font-bold">
                      👤 {selectedMember.name}
                    </div>

                    {selectedMember.phone && (
                      <div className="text-xs text-muted-foreground">
                        {selectedMember.phone}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMember(null);
                      setMemberSearch("");

                      window.setTimeout(() => {
                        memberSearchRef.current?.focus();
                      }, 0);
                    }}
                    disabled={saving}
                    className="shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border bg-background p-3">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Seleccionar miembro
                  </div>

                  <input
                    ref={memberSearchRef}
                    type="text"
                    value={memberSearch}
                    onChange={(event) =>
                      setMemberSearch(
                        event.target.value,
                      )
                    }
                    placeholder="Nombre o teléfono..."
                    autoComplete="off"
                    disabled={
                      loadingMembers || saving
                    }
                    className="h-11 w-full rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
                  />

                  <div className="mt-2 max-h-48 overflow-y-auto">
                    {loadingMembers ? (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        Cargando miembros...
                      </div>
                    ) : filteredMembers.length === 0 ? (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        No encontramos miembros.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredMembers.map(
                          (member) => (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() =>
                                selectMember(
                                  member,
                                )
                              }
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-muted"
                            >
                              <span className="font-medium">
                                {member.name}
                              </span>

                              {member.phone && (
                                <span className="ml-3 text-xs text-muted-foreground">
                                  {member.phone}
                                </span>
                              )}
                            </button>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="flex h-full min-h-[250px] items-center justify-center text-center">
                <div>
                  <div className="text-4xl">🛒</div>

                  <div className="mt-3 font-medium">
                    El carrito está vacío
                  </div>

                  <div className="mt-1 text-sm text-muted-foreground">
                    Escanea un producto o selecciónalo
                    de la lista.
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => {
                  const itemTotal =
                    Number(
                      item.product.sale_price,
                    ) * item.quantity;

                  return (
                    <div
                      key={item.product.id}
                      className="rounded-lg border p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium">
                            {item.product.name}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            $
                            {Number(
                              item.product.sale_price,
                            ).toLocaleString(
                              "es-CO",
                            )}{" "}
                            c/u
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeFromCart(
                              item.product.id,
                            )
                          }
                          disabled={saving}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Quitar
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center rounded-lg border">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.product.id,
                                item.quantity - 1,
                              )
                            }
                            disabled={saving}
                            className="h-9 w-9 text-lg hover:bg-muted"
                          >
                            −
                          </button>

                          <div className="w-10 text-center text-sm font-medium">
                            {item.quantity}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.product.id,
                                item.quantity + 1,
                              )
                            }
                            disabled={saving}
                            className="h-9 w-9 text-lg hover:bg-muted"
                          >
                            +
                          </button>
                        </div>

                        <div className="font-semibold">
                          $
                          {itemTotal.toLocaleString(
                            "es-CO",
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* COBRO */}

          <div className="border-t bg-muted/20 p-4">
            <div className="mb-5 rounded-xl border bg-background px-4 py-5 text-center">
              <div className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Total a cobrar
              </div>

              <div className="mt-1 text-5xl font-black tracking-tight">
                ${total.toLocaleString("es-CO")}
              </div>
            </div>

            {/* MÉTODOS */}

            <div className="mb-4 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={selectCash}
                disabled={saving}
                className={`flex min-h-[90px] flex-col items-center justify-center rounded-xl border-2 px-2 py-3 text-sm font-bold transition ${
                  paymentMode === "cash"
                    ? "border-primary bg-primary text-primary-foreground shadow-md"
                    : "border-border bg-background hover:border-primary/50 hover:bg-muted"
                }`}
              >
                <span className="text-3xl">
                  💵
                </span>
                <span className="mt-1">
                  EFECTIVO
                </span>
              </button>

              <button
                type="button"
                onClick={selectNequi}
                disabled={saving}
                className={`flex min-h-[90px] flex-col items-center justify-center rounded-xl border-2 px-2 py-3 text-sm font-bold transition ${
                  paymentMode === "nequi"
                    ? "border-primary bg-primary text-primary-foreground shadow-md"
                    : "border-border bg-background hover:border-primary/50 hover:bg-muted"
                }`}
              >
                <span className="text-3xl">
                  📱
                </span>
                <span className="mt-1">
                  NEQUI
                </span>
              </button>

              <button
                type="button"
                onClick={selectAccountMode}
                disabled={saving}
                className={`flex min-h-[90px] flex-col items-center justify-center rounded-xl border-2 px-2 py-3 text-sm font-bold transition ${
                  paymentMode === "account"
                    ? "border-primary bg-primary text-primary-foreground shadow-md"
                    : "border-border bg-background hover:border-primary/50 hover:bg-muted"
                }`}
              >
                <span className="text-3xl">
                  👤
                </span>
                <span className="mt-1">
                  A CUENTA
                </span>
              </button>
            </div>

            {/* COBRAR */}

            <button
              type="button"
              onClick={completeSale}
              disabled={
                cart.length === 0 ||
                saving ||
                (paymentMode === "account" &&
                  !selectedMember)
              }
              className="h-16 w-full rounded-xl bg-primary px-4 text-xl font-black text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "PROCESANDO..."
                : paymentMode === "account"
                  ? `COBRAR A CUENTA $${total.toLocaleString(
                      "es-CO",
                    )}`
                  : `COBRAR $${total.toLocaleString(
                      "es-CO",
                    )}`}
            </button>

            {paymentMode === "account" &&
              !selectedMember && (
                <button
                  type="button"
                  onClick={cancelAccountMode}
                  disabled={saving}
                  className="mt-2 h-10 w-full rounded-lg text-sm font-semibold text-muted-foreground hover:bg-muted"
                >
                  Cancelar cuenta
                </button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
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

export default function VentasPage() {
  const supabase = createClient();

  const searchRef = useRef<HTMLInputElement>(null);

  // Buffer utilizado para detectar códigos enviados rápidamente por el escáner.
  const scannerBufferRef = useRef("");
  const scannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyTimeRef = useRef(0);

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "nequi">(
    "cash"
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, barcode, sale_price, stock, track_inventory, active"
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

  function focusScanner() {
    window.setTimeout(() => {
      searchRef.current?.focus();
    }, 0);
  }

  function findProduct(value: string) {
    const cleanValue = value.trim().toLowerCase();

    if (!cleanValue) return null;

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
        (item) => item.product.id === product.id
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
          `No puedes agregar más "${product.name}". Stock disponible: ${product.stock}.`
        );

        return currentCart;
      }

      return currentCart.map((item) =>
        item.product.id === product.id
          ? {
              ...item,
              quantity: newQuantity,
            }
          : item
      );
    });

    setSearch("");
    scannerBufferRef.current = "";

    focusScanner();
  }

  function processScannedCode(code: string) {
    const cleanCode = code.trim();

    if (!cleanCode) return;

    const product = findProduct(cleanCode);

    if (product) {
      addToCart(product);
      return;
    }

    setError(`No encontramos ningún producto para "${cleanCode}".`);
    setSearch("");
    scannerBufferRef.current = "";
    focusScanner();
  }

  /*
   * DETECTOR AUTOMÁTICO DEL ESCÁNER
   *
   * Un lector de códigos normalmente envía todas las teclas
   * prácticamente de golpe.
   *
   * Si las teclas llegan con menos de 50 ms entre ellas,
   * las consideramos parte de un escaneo.
   *
   * No necesitamos Enter.
   */

  function handleScannerKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
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

    /*
     * Si pasó demasiado tiempo desde la tecla anterior,
     * probablemente estamos escribiendo manualmente.
     */
    if (elapsed > 80) {
      scannerBufferRef.current = "";
    }

    scannerBufferRef.current += event.key;

    if (scannerTimerRef.current) {
      clearTimeout(scannerTimerRef.current);
    }

    /*
     * Esperamos apenas 60 ms para confirmar que terminó
     * la ráfaga del escáner.
     */
    scannerTimerRef.current = setTimeout(() => {
      const code = scannerBufferRef.current.trim();

      if (!code) return;

      scannerBufferRef.current = "";

      /*
       * Solo procesamos automáticamente códigos que tengan
       * longitud razonable para un código de barras.
       *
       * Esto evita que una persona escribiendo "agua"
       * provoque una venta automática.
       */
      if (code.length >= 6) {
        const product = findProduct(code);

        if (product) {
          addToCart(product);
        }
      }
    }, 60);
  }

  function updateQuantity(productId: string, quantity: number) {
    const product = products.find((item) => item.id === productId);

    if (!product) return;

    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    if (
      product.track_inventory &&
      quantity > Number(product.stock)
    ) {
      setError(
        `Stock insuficiente para "${product.name}". Disponible: ${product.stock}.`
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
          : item
      )
    );
  }

  function removeFromCart(productId: string) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.product.id !== productId)
    );

    focusScanner();
  }

  function clearCart() {
    setCart([]);
    setError("");
    setMessage("");
    setSearch("");
    scannerBufferRef.current = "";

    focusScanner();
  }

  function handleManualSearchKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key !== "Enter") return;

    event.preventDefault();

    const value = search.trim();

    if (!value) return;

    const exactProduct = findProduct(value);

    if (exactProduct) {
      addToCart(exactProduct);
      return;
    }

    const query = value.toLowerCase();

    const filtered = products.filter((product) => {
      return (
        product.name.toLowerCase().includes(query) ||
        (product.barcode ?? "").toLowerCase().includes(query)
      );
    });

    if (filtered.length === 1) {
      addToCart(filtered[0]);
      return;
    }

    if (filtered.length === 0) {
      setError(`No encontramos ningún producto para "${value}".`);
    }
  }

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return products;

    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(query) ||
        (product.barcode ?? "").toLowerCase().includes(query)
      );
    });
  }, [products, search]);

  const total = useMemo(() => {
    return cart.reduce(
      (sum, item) =>
        sum + Number(item.product.sale_price) * item.quantity,
      0
    );
  }, [cart]);

  async function completeSale() {
    setError("");
    setMessage("");

    if (cart.length === 0) {
      setError("Agrega al menos un producto.");
      focusScanner();
      return;
    }

    setSaving(true);

    const items = cart.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity,
    }));

    const { data, error } = await supabase.rpc("create_sale", {
      p_items: items,
      p_payment_method: paymentMethod,
      p_member_id: null,
      p_account_id: null,
    });

    if (error) {
      setError(`No se pudo completar la venta: ${error.message}`);
      setSaving(false);
      focusScanner();
      return;
    }

    /*
     * Actualizamos el stock local inmediatamente.
     * No hacemos otra consulta antes de permitir
     * la siguiente venta.
     */

    setProducts((currentProducts) =>
      currentProducts.map((product) => {
        const soldItem = cart.find(
          (item) => item.product.id === product.id
        );

        if (!soldItem || !product.track_inventory) {
          return product;
        }

        return {
          ...product,
          stock: Math.max(
            0,
            Number(product.stock) - soldItem.quantity
          ),
        };
      })
    );

    const saleTotal = Number(data.total);

    setCart([]);
    setSearch("");
    scannerBufferRef.current = "";

    setMessage(
      `Venta #${data.sale_number} registrada por $${saleTotal.toLocaleString(
        "es-CO"
      )}.`
    );

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
          Registra ventas, escanea productos y cobra rápidamente.
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
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  handleScannerKeyDown(event);

                  if (event.key === "Enter") {
                    handleManualSearchKeyDown(event);
                  }
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
              Escanea directamente. No necesitas presionar Enter.
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
                    product.track_inventory && product.stock <= 0;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={unavailable || saving}
                      onClick={() => addToCart(product)}
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
                            product.sale_price
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
              <h2 className="font-semibold">Venta actual</h2>

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

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="flex h-full min-h-[250px] items-center justify-center text-center">
                <div>
                  <div className="text-4xl">🛒</div>

                  <div className="mt-3 font-medium">
                    El carrito está vacío
                  </div>

                  <div className="mt-1 text-sm text-muted-foreground">
                    Escanea un producto o selecciónalo de la lista.
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => {
                  const itemTotal =
                    Number(item.product.sale_price) * item.quantity;

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
                              item.product.sale_price
                            ).toLocaleString("es-CO")}{" "}
                            c/u
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeFromCart(item.product.id)
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
                                item.quantity - 1
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
                                item.quantity + 1
                              )
                            }
                            disabled={saving}
                            className="h-9 w-9 text-lg hover:bg-muted"
                          >
                            +
                          </button>
                        </div>

                        <div className="font-semibold">
                          ${itemTotal.toLocaleString("es-CO")}
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

            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                disabled={saving}
                className={`flex min-h-[95px] flex-col items-center justify-center rounded-xl border-2 px-3 py-4 text-base font-bold transition ${
                  paymentMethod === "cash"
                    ? "border-primary bg-primary text-primary-foreground shadow-md"
                    : "border-border bg-background hover:border-primary/50 hover:bg-muted"
                }`}
              >
                <span className="text-3xl">💵</span>
                <span className="mt-1">EFECTIVO</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("nequi")}
                disabled={saving}
                className={`flex min-h-[95px] flex-col items-center justify-center rounded-xl border-2 px-3 py-4 text-base font-bold transition ${
                  paymentMethod === "nequi"
                    ? "border-primary bg-primary text-primary-foreground shadow-md"
                    : "border-border bg-background hover:border-primary/50 hover:bg-muted"
                }`}
              >
                <span className="text-3xl">📱</span>
                <span className="mt-1">NEQUI</span>
              </button>
            </div>

            <button
              type="button"
              onClick={completeSale}
              disabled={cart.length === 0 || saving}
              className="h-16 w-full rounded-xl bg-primary px-4 text-xl font-black text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "PROCESANDO..."
                : `COBRAR $${total.toLocaleString("es-CO")}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
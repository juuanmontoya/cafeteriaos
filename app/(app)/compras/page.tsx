"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
};

type Product = {
  id: string;
  name: string;
  barcode: string | null;
  stock: number;
  cost_price: number;
  active: boolean;
  track_inventory: boolean;
};

type PurchaseItem = {
  productId: string;
  quantity: string;
  unitCost: string;
};

type Purchase = {
  id: string;
  supplier_id: string | null;
  total: number;
  notes: string | null;
  created_at: string;
  supplierName: string;
};

type PurchaseDetail = {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  total: number;
  productName: string;
  barcode: string | null;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CO").format(value);
}

function formatTime(dateString: string) {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function getDateKey(dateString: string) {
  const date = new Date(dateString);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateHeading(dateString: string) {
  const date = new Date(dateString);

  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function ComprasPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseDetails, setPurchaseDetails] = useState<
    Record<string, PurchaseDetail[]>
  >({});

  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<PurchaseItem[]>([
    {
      productId: "",
      quantity: "",
      unitCost: "",
    },
  ]);

  const [expandedPurchase, setExpandedPurchase] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const supabase = createClient();

    const [
      suppliersResult,
      productsResult,
      purchasesResult,
    ] = await Promise.all([
      supabase
        .from("suppliers")
        .select("id, name, phone, active")
        .eq("active", true)
        .order("name"),

      supabase
        .from("products")
        .select(
          "id, name, barcode, stock, cost_price, active, track_inventory"
        )
        .eq("active", true)
        .eq("track_inventory", true)
        .order("name"),

      supabase
        .from("purchases")
        .select(
          "id, supplier_id, total, notes, created_at"
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(100),
    ]);

    if (suppliersResult.error) {
      setError(suppliersResult.error.message);
      setLoading(false);
      return;
    }

    if (productsResult.error) {
      setError(productsResult.error.message);
      setLoading(false);
      return;
    }

    if (purchasesResult.error) {
      setError(purchasesResult.error.message);
      setLoading(false);
      return;
    }

    const loadedSuppliers =
      (suppliersResult.data ?? []) as Supplier[];

    const loadedProducts =
      (productsResult.data ?? []) as Product[];

    const loadedPurchases =
      (purchasesResult.data ?? []) as Omit<
        Purchase,
        "supplierName"
      >[];

    const supplierMap = new Map(
      loadedSuppliers.map((supplier) => [
        supplier.id,
        supplier.name,
      ])
    );

    const purchasesWithSupplier: Purchase[] =
      loadedPurchases.map((purchase) => ({
        ...purchase,
        supplierName: purchase.supplier_id
          ? supplierMap.get(purchase.supplier_id) ??
            "Proveedor no encontrado"
          : "Sin proveedor",
      }));

    setSuppliers(loadedSuppliers);
    setProducts(loadedProducts);
    setPurchases(purchasesWithSupplier);

    setLoading(false);
    setLoadingHistory(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantity = Number(item.quantity);
      const unitCost = Number(item.unitCost);

      if (
        !Number.isFinite(quantity) ||
        !Number.isFinite(unitCost)
      ) {
        return sum;
      }

      return sum + quantity * unitCost;
    }, 0);
  }, [items]);

  const groupedPurchases = useMemo(() => {
    const groups: Record<string, Purchase[]> = {};

    purchases.forEach((purchase) => {
      const key = getDateKey(purchase.created_at);

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(purchase);
    });

    return Object.entries(groups).sort(
      ([dateA], [dateB]) =>
        dateB.localeCompare(dateA)
    );
  }, [purchases]);

  function addItem() {
    setItems([
      ...items,
      {
        productId: "",
        quantity: "",
        unitCost: "",
      },
    ]);
  }

  function removeItem(index: number) {
    if (items.length === 1) {
      return;
    }

    setItems(
      items.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function updateItem(
    index: number,
    field: keyof PurchaseItem,
    value: string
  ) {
    setItems(
      items.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const updated = {
          ...item,
          [field]: value,
        };

        if (
          field === "productId" &&
          value &&
          !item.unitCost
        ) {
          const product = products.find(
            (product) => product.id === value
          );

          if (product && product.cost_price > 0) {
            updated.unitCost =
              String(product.cost_price);
          }
        }

        return updated;
      })
    );
  }

  function validateItems() {
    if (items.length === 0) {
      return "Agrega al menos un producto.";
    }

    for (let index = 0; index < items.length; index++) {
      const item = items[index];

      if (!item.productId) {
        return `Selecciona un producto en la línea ${
          index + 1
        }.`;
      }

      const quantity = Number(item.quantity);
      const unitCost = Number(item.unitCost);

      if (
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        return `La cantidad de la línea ${
          index + 1
        } debe ser mayor que 0.`;
      }

      if (!Number.isInteger(quantity)) {
        return `La cantidad de la línea ${
          index + 1
        } debe ser un número entero.`;
      }

      if (
        !Number.isFinite(unitCost) ||
        unitCost < 0
      ) {
        return `El costo de la línea ${
          index + 1
        } no puede ser negativo.`;
      }
    }

    const productIds = items.map(
      (item) => item.productId
    );

    const uniqueProductIds = new Set(productIds);

    if (uniqueProductIds.size !== productIds.length) {
      return "No puedes agregar el mismo producto dos veces en la misma compra.";
    }

    return "";
  }

  async function loadPurchaseDetail(
    purchaseId: string
  ) {
    const supabase = createClient();

    setLoadingDetail(true);
    setError("");

    const { data, error } = await supabase
      .from("purchase_items")
      .select(
        "id, purchase_id, product_id, quantity, unit_cost, total"
      )
      .eq("purchase_id", purchaseId)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      setError(error.message);
      setLoadingDetail(false);
      return;
    }

    const loadedItems =
      (data ?? []) as Omit<
        PurchaseDetail,
        "productName" | "barcode"
      >[];

    const productIds = [
      ...new Set(
        loadedItems.map((item) => item.product_id)
      ),
    ];

    let loadedProducts: Product[] = [];

    if (productIds.length > 0) {
      const { data: productsData, error: productsError } =
        await supabase
          .from("products")
          .select("id, name, barcode")
          .in("id", productIds);

      if (productsError) {
        setError(productsError.message);
        setLoadingDetail(false);
        return;
      }

      loadedProducts = (productsData ?? []) as Product[];
    }

    const productMap = new Map(
      loadedProducts.map((product) => [
        product.id,
        {
          name: product.name,
          barcode: product.barcode,
        },
      ])
    );

    const details: PurchaseDetail[] =
      loadedItems.map((item) => {
        const product = productMap.get(
          item.product_id
        );

        return {
          ...item,
          productName:
            product?.name ?? "Producto no encontrado",
          barcode: product?.barcode ?? null,
        };
      });

    setPurchaseDetails((current) => ({
      ...current,
      [purchaseId]: details,
    }));

    setLoadingDetail(false);
  }

  async function togglePurchase(
    purchaseId: string
  ) {
    if (expandedPurchase === purchaseId) {
      setExpandedPurchase(null);
      return;
    }

    setExpandedPurchase(purchaseId);

    if (!purchaseDetails[purchaseId]) {
      await loadPurchaseDetail(purchaseId);
    }
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const validationError = validateItems();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    const supabase = createClient();

    const purchaseItems = items.map((item) => ({
      product_id: item.productId,
      quantity: Number(item.quantity),
      unit_cost: Number(item.unitCost),
    }));

    const { data, error } = await supabase.rpc(
      "create_purchase",
      {
        p_supplier_id: supplierId || null,
        p_notes: notes.trim() || null,
        p_items: purchaseItems,
      }
    );

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    const purchaseId = Array.isArray(data)
      ? data[0]?.id
      : data?.id;

    setSuccess(
      `Compra registrada correctamente${
        purchaseId
          ? ` · Total: ${formatMoney(total)}`
          : ""
      }. El inventario fue actualizado.`
    );

    setSupplierId("");
    setNotes("");

    setItems([
      {
        productId: "",
        quantity: "",
        unitCost: "",
      },
    ]);

    setExpandedPurchase(null);

    setSaving(false);

    setLoadingHistory(true);
    await loadData();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Compras
          </h1>

          <p className="mt-1 text-muted-foreground">
            Registra compras y aumenta automáticamente el
            inventario.
          </p>
        </div>

        <div className="rounded-xl border bg-background p-10 text-center text-sm text-muted-foreground shadow-sm">
          Cargando...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ENCABEZADO */}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Compras
        </h1>

        <p className="mt-1 text-muted-foreground">
          Registra compras y aumenta automáticamente el
          inventario.
        </p>
      </div>

      {/* MENSAJES */}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* FORMULARIO */}

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {/* INFORMACIÓN */}

        <div className="rounded-xl border bg-background p-5 shadow-sm">
          <h2 className="font-semibold">
            Registrar compra
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Proveedor
              </label>

              <select
                value={supplierId}
                onChange={(event) =>
                  setSupplierId(event.target.value)
                }
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">
                  Sin proveedor
                </option>

                {suppliers.map((supplier) => (
                  <option
                    key={supplier.id}
                    value={supplier.id}
                  >
                    {supplier.name}
                  </option>
                ))}
              </select>

              {suppliers.length === 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Todavía no hay proveedores registrados.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Nota
              </label>

              <input
                type="text"
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="Ej. Compra semanal"
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* PRODUCTOS */}

        <div className="rounded-xl border bg-background shadow-sm">
          <div className="flex items-center justify-between border-b p-5">
            <div>
              <h2 className="font-semibold">
                Productos
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Agrega los productos recibidos y su costo.
              </p>
            </div>

            <button
              type="button"
              onClick={addItem}
              className="rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-muted"
            >
              + Agregar producto
            </button>
          </div>

          <div className="divide-y">
            {items.map((item, index) => {
              const product = products.find(
                (product) =>
                  product.id === item.productId
              );

              const quantity = Number(item.quantity);
              const unitCost = Number(item.unitCost);

              const subtotal =
                Number.isFinite(quantity) &&
                Number.isFinite(unitCost)
                  ? quantity * unitCost
                  : 0;

              return (
                <div
                  key={index}
                  className="p-5"
                >
                  <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_auto]">
                    {/* PRODUCTO */}

                    <div>
                      <label className="mb-1.5 block text-sm font-medium">
                        Producto
                      </label>

                      <select
                        value={item.productId}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "productId",
                            event.target.value
                          )
                        }
                        className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">
                          Seleccionar producto...
                        </option>

                        {products.map((product) => (
                          <option
                            key={product.id}
                            value={product.id}
                          >
                            {product.name}
                          </option>
                        ))}
                      </select>

                      {product && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Stock actual:{" "}
                          {formatNumber(product.stock)}
                          {product.barcode
                            ? ` · Código: ${product.barcode}`
                            : ""}
                        </p>
                      )}
                    </div>

                    {/* CANTIDAD */}

                    <div>
                      <label className="mb-1.5 block text-sm font-medium">
                        Cantidad
                      </label>

                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "quantity",
                            event.target.value
                          )
                        }
                        placeholder="0"
                        className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>

                    {/* COSTO */}

                    <div>
                      <label className="mb-1.5 block text-sm font-medium">
                        Costo unitario
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.unitCost}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "unitCost",
                            event.target.value
                          )
                        }
                        placeholder="$0"
                        className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />

                      {item.unitCost && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {formatMoney(
                            Number(item.unitCost)
                          )}
                        </p>
                      )}
                    </div>

                    {/* ELIMINAR */}

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() =>
                          removeItem(index)
                        }
                        disabled={items.length === 1}
                        className="w-full rounded-lg border px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end text-sm">
                    <span className="text-muted-foreground">
                      Subtotal:
                    </span>

                    <span className="ml-2 font-semibold">
                      {formatMoney(subtotal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* TOTAL */}

          <div className="border-t bg-muted/30 p-5">
            <div className="flex items-center justify-between">
              <span className="text-base font-medium">
                Total de la compra
              </span>

              <span className="text-2xl font-bold">
                {formatMoney(total)}
              </span>
            </div>
          </div>
        </div>

        {/* BOTÓN */}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Registrando compra..."
              : "Registrar compra"}
          </button>
        </div>
      </form>

      {/* HISTORIAL */}

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Historial de compras
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Consulta las compras realizadas y el detalle de
            cada una.
          </p>
        </div>

        {loadingHistory ? (
          <div className="rounded-xl border bg-background p-8 text-center text-sm text-muted-foreground shadow-sm">
            Cargando historial...
          </div>
        ) : purchases.length === 0 ? (
          <div className="rounded-xl border bg-background p-10 text-center shadow-sm">
            <div className="text-3xl">
              🧾
            </div>

            <p className="mt-3 font-medium">
              Todavía no hay compras registradas
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Las compras que registres aparecerán aquí
              agrupadas por día.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedPurchases.map(
              ([dateKey, datePurchases]) => (
                <div
                  key={dateKey}
                  className="space-y-3"
                >
                  {/* FECHA */}

                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />

                    <div className="rounded-full bg-muted px-4 py-1.5 text-xs font-semibold capitalize text-muted-foreground">
                      {formatDateHeading(
                        datePurchases[0].created_at
                      )}
                    </div>

                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {/* COMPRAS DEL DÍA */}

                  <div className="space-y-3">
                    {datePurchases.map((purchase) => {
                      const isExpanded =
                        expandedPurchase ===
                        purchase.id;

                      const details =
                        purchaseDetails[
                          purchase.id
                        ];

                      return (
                        <div
                          key={purchase.id}
                          className="overflow-hidden rounded-xl border bg-background shadow-sm"
                        >
                          {/* RESUMEN */}

                          <button
                            type="button"
                            onClick={() =>
                              togglePurchase(
                                purchase.id
                              )
                            }
                            className="w-full p-5 text-left transition hover:bg-muted/30"
                          >
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                              <div className="flex items-start gap-4">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-xl">
                                  🧾
                                </div>

                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-semibold">
                                      Compra #
                                      {purchase.id
                                        .slice(0, 8)
                                        .toUpperCase()}
                                    </h3>

                                    <span className="text-xs text-muted-foreground">
                                      {formatTime(
                                        purchase.created_at
                                      )}
                                    </span>
                                  </div>

                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {purchase.supplierName}
                                  </p>

                                  {purchase.notes && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {purchase.notes}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-6 md:justify-end">
                                <div className="text-right">
                                  <p className="text-lg font-bold">
                                    {formatMoney(
                                      Number(
                                        purchase.total
                                      )
                                    )}
                                  </p>

                                  <p className="text-xs text-muted-foreground">
                                    Ver detalle
                                  </p>
                                </div>

                                <div className="text-muted-foreground">
                                  {isExpanded
                                    ? "⌃"
                                    : "⌄"}
                                </div>
                              </div>
                            </div>
                          </button>

                          {/* DETALLE */}

                          {isExpanded && (
                            <div className="border-t bg-muted/20">
                              {loadingDetail &&
                              !details ? (
                                <div className="p-6 text-center text-sm text-muted-foreground">
                                  Cargando detalle...
                                </div>
                              ) : details &&
                                details.length > 0 ? (
                                <div>
                                  {/* DESKTOP */}

                                  <div className="hidden md:block">
                                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                      <span>
                                        Producto
                                      </span>

                                      <span className="text-right">
                                        Cantidad
                                      </span>

                                      <span className="text-right">
                                        Costo unitario
                                      </span>

                                      <span className="text-right">
                                        Total
                                      </span>
                                    </div>

                                    <div className="divide-y">
                                      {details.map(
                                        (detail) => (
                                          <div
                                            key={
                                              detail.id
                                            }
                                            className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center px-5 py-4 text-sm"
                                          >
                                            <div>
                                              <p className="font-medium">
                                                {
                                                  detail.productName
                                                }
                                              </p>

                                              {detail.barcode && (
                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                  Código:{" "}
                                                  {
                                                    detail.barcode
                                                  }
                                                </p>
                                              )}
                                            </div>

                                            <span className="text-right">
                                              {formatNumber(
                                                Number(
                                                  detail.quantity
                                                )
                                              )}
                                            </span>

                                            <span className="text-right">
                                              {formatMoney(
                                                Number(
                                                  detail.unit_cost
                                                )
                                              )}
                                            </span>

                                            <span className="text-right font-medium">
                                              {formatMoney(
                                                Number(
                                                  detail.total
                                                )
                                              )}
                                            </span>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </div>

                                  {/* MOBILE */}

                                  <div className="divide-y md:hidden">
                                    {details.map(
                                      (detail) => (
                                        <div
                                          key={
                                            detail.id
                                          }
                                          className="p-5"
                                        >
                                          <div className="flex items-start justify-between gap-4">
                                            <div>
                                              <p className="font-medium">
                                                {
                                                  detail.productName
                                                }
                                              </p>

                                              <p className="mt-1 text-sm text-muted-foreground">
                                                Cantidad:{" "}
                                                {formatNumber(
                                                  Number(
                                                    detail.quantity
                                                  )
                                                )}
                                              </p>

                                              <p className="text-sm text-muted-foreground">
                                                Costo unitario:{" "}
                                                {formatMoney(
                                                  Number(
                                                    detail.unit_cost
                                                  )
                                                )}
                                              </p>
                                            </div>

                                            <p className="font-semibold">
                                              {formatMoney(
                                                Number(
                                                  detail.total
                                                )
                                              )}
                                            </p>
                                          </div>
                                        </div>
                                      )
                                    )}
                                  </div>

                                  {/* TOTAL DETALLE */}

                                  <div className="flex items-center justify-between border-t bg-background px-5 py-4">
                                    <span className="font-medium">
                                      Total
                                    </span>

                                    <span className="text-lg font-bold">
                                      {formatMoney(
                                        Number(
                                          purchase.total
                                        )
                                      )}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-6 text-center text-sm text-muted-foreground">
                                  Esta compra no tiene
                                  productos registrados.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
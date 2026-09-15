"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  barcode: string | null;
  stock: number;
  min_stock: number;
  track_inventory: boolean;
  prepared: boolean;
  active: boolean;
  category_id: string | null;
};

type Category = {
  id: string;
  name: string;
  icon: string | null;
};

type ProductWithCategory = Product & {
  category: Category | null;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CO").format(value);
}

export default function InventarioPage() {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");

  const [showProduction, setShowProduction] = useState(false);
  const [productionProductId, setProductionProductId] =
    useState("");
  const [productionQuantity, setProductionQuantity] =
    useState("");
  const [productionNotes, setProductionNotes] = useState("");
  const [productionLoading, setProductionLoading] =
    useState(false);
  const [productionError, setProductionError] = useState("");
  const [productionSuccess, setProductionSuccess] =
    useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const supabase = createClient();

    const [productsResult, categoriesResult] = await Promise.all([
      supabase
        .from("products")
        .select(
          `
            id,
            name,
            barcode,
            stock,
            min_stock,
            track_inventory,
            prepared,
            active,
            category_id
          `
        )
        .eq("active", true)
        .order("name"),

      supabase
        .from("categories")
        .select("id, name, icon")
        .eq("active", true)
        .order("name"),
    ]);

    if (productsResult.error) {
      setError(productsResult.error.message);
      setLoading(false);
      return;
    }

    if (categoriesResult.error) {
      setError(categoriesResult.error.message);
      setLoading(false);
      return;
    }

    const productData = (productsResult.data ?? []) as Product[];
    const categoryData = categoriesResult.data ?? [];

    const productsWithCategories: ProductWithCategory[] =
      productData.map((product) => ({
        ...product,
        category:
          categoryData.find(
            (category) => category.id === product.category_id
          ) ?? null,
      }));

    setProducts(productsWithCategories);
    setCategories(categoryData);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const inventoryProducts = useMemo(() => {
    return products.filter((product) => product.track_inventory);
  }, [products]);

  const preparedProducts = useMemo(() => {
    return inventoryProducts.filter(
      (product) => product.prepared
    );
  }, [inventoryProducts]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return inventoryProducts.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.barcode?.toLowerCase().includes(normalizedSearch);

      const matchesCategory =
        categoryFilter === "all" ||
        product.category_id === categoryFilter;

      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "low" &&
          product.stock > 0 &&
          product.stock <= product.min_stock) ||
        (stockFilter === "out" && product.stock === 0) ||
        (stockFilter === "ok" &&
          product.stock > product.min_stock);

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [
    inventoryProducts,
    search,
    categoryFilter,
    stockFilter,
  ]);

  const totalUnits = useMemo(() => {
    return inventoryProducts.reduce(
      (total, product) => total + product.stock,
      0
    );
  }, [inventoryProducts]);

  const lowStockCount = useMemo(() => {
    return inventoryProducts.filter(
      (product) =>
        product.stock > 0 && product.stock <= product.min_stock
    ).length;
  }, [inventoryProducts]);

  const outOfStockCount = useMemo(() => {
    return inventoryProducts.filter(
      (product) => product.stock === 0
    ).length;
  }, [inventoryProducts]);

  const preparedCount = useMemo(() => {
    return inventoryProducts.filter(
      (product) => product.prepared
    ).length;
  }, [inventoryProducts]);

  function getStockStatus(product: ProductWithCategory) {
    if (product.stock === 0) {
      return {
        label: "Agotado",
        className: "bg-red-100 text-red-700",
      };
    }

    if (product.stock <= product.min_stock) {
      return {
        label: "Stock bajo",
        className: "bg-amber-100 text-amber-700",
      };
    }

    return {
      label: "Normal",
      className: "bg-green-100 text-green-700",
    };
  }

  async function handleProduction() {
    setProductionError("");
    setProductionSuccess("");

    if (!productionProductId) {
      setProductionError("Selecciona un producto.");
      return;
    }

    const quantity = Number(productionQuantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setProductionError(
        "La cantidad debe ser mayor que 0."
      );
      return;
    }

    setProductionLoading(true);

    const supabase = createClient();

    const { data, error } = await supabase.rpc(
      "add_production",
      {
        p_product_id: productionProductId,
        p_quantity: quantity,
        p_notes:
          productionNotes.trim() || null,
      }
    );

    if (error) {
      setProductionError(error.message);
      setProductionLoading(false);
      return;
    }

    const producedProduct = Array.isArray(data)
      ? data[0]
      : data;

    const producedName =
      producedProduct?.name ??
      preparedProducts.find(
        (product) => product.id === productionProductId
      )?.name ??
      "producto";

    setProductionSuccess(
      `Producción registrada: ${formatNumber(
        quantity
      )} unidades de ${producedName}.`
    );

    setProductionProductId("");
    setProductionQuantity("");
    setProductionNotes("");
    setProductionLoading(false);

    await loadData();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Inventario
          </h1>

          <p className="mt-1 text-muted-foreground">
            Consulta y administra las existencias de la
            cafetería.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowProduction(!showProduction);
            setProductionError("");
            setProductionSuccess("");
          }}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          {showProduction
            ? "Cerrar producción"
            : "+ Registrar producción"}
        </button>
      </div>

      {showProduction && (
        <div className="rounded-xl border bg-background p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="font-semibold">
              Registrar producción
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Registra las unidades preparadas para aumentar
              automáticamente el inventario.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Producto
              </label>

              <select
                value={productionProductId}
                onChange={(event) => {
                  setProductionProductId(
                    event.target.value
                  );
                  setProductionError("");
                }}
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">
                  Seleccionar producto...
                </option>

                {preparedProducts.map((product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.name} — stock actual:{" "}
                    {formatNumber(product.stock)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Cantidad producida
              </label>

              <input
                type="number"
                min="0.01"
                step="1"
                value={productionQuantity}
                onChange={(event) =>
                  setProductionQuantity(
                    event.target.value
                  )
                }
                placeholder="Ej. 20"
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Nota
              </label>

              <input
                type="text"
                value={productionNotes}
                onChange={(event) =>
                  setProductionNotes(event.target.value)
                }
                placeholder="Ej. Producción de la mañana"
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {productionError && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {productionError}
            </div>
          )}

          {productionSuccess && (
            <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              {productionSuccess}
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleProduction}
              disabled={productionLoading}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {productionLoading
                ? "Registrando..."
                : "Registrar producción"}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-background p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Productos controlados
          </p>

          <p className="mt-2 text-2xl font-bold">
            {inventoryProducts.length}
          </p>
        </div>

        <div className="rounded-xl border bg-background p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Unidades disponibles
          </p>

          <p className="mt-2 text-2xl font-bold">
            {formatNumber(totalUnits)}
          </p>
        </div>

        <div className="rounded-xl border bg-background p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Stock bajo
          </p>

          <p className="mt-2 text-2xl font-bold text-amber-600">
            {lowStockCount}
          </p>
        </div>

        <div className="rounded-xl border bg-background p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Agotados
          </p>

          <p className="mt-2 text-2xl font-bold text-red-600">
            {outOfStockCount}
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-background shadow-sm">
        <div className="border-b p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold">
                Existencias
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                {preparedCount} productos preparados.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar producto..."
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring sm:w-64"
              />

              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value)
                }
                className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">
                  Todas las categorías
                </option>

                {categories.map((category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.icon
                      ? `${category.icon} `
                      : ""}
                    {category.name}
                  </option>
                ))}
              </select>

              <select
                value={stockFilter}
                onChange={(event) =>
                  setStockFilter(event.target.value)
                }
                className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">
                  Todos los estados
                </option>

                <option value="ok">
                  Stock normal
                </option>

                <option value="low">
                  Stock bajo
                </option>

                <option value="out">
                  Agotados
                </option>
              </select>
            </div>
          </div>
        </div>

        {loading && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Cargando inventario...
          </div>
        )}

        {!loading && error && (
          <div className="p-6">
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              Error: {error}
            </div>
          </div>
        )}

        {!loading &&
          !error &&
          filteredProducts.length === 0 && (
            <div className="p-10 text-center">
              <div className="text-4xl">📦</div>

              <h3 className="mt-3 font-semibold">
                No hay productos para mostrar
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Prueba cambiando los filtros o crea productos
                con control de inventario.
              </p>
            </div>
          )}

        {!loading &&
          !error &&
          filteredProducts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-5 py-3 text-left font-medium">
                      Producto
                    </th>

                    <th className="px-5 py-3 text-left font-medium">
                      Categoría
                    </th>

                    <th className="px-5 py-3 text-right font-medium">
                      Existencia
                    </th>

                    <th className="px-5 py-3 text-right font-medium">
                      Mínimo
                    </th>

                    <th className="px-5 py-3 text-center font-medium">
                      Estado
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map((product) => {
                    const status =
                      getStockStatus(product);

                    return (
                      <tr
                        key={product.id}
                        className="border-b last:border-0"
                      >
                        <td className="px-5 py-4">
                          <div className="font-medium">
                            {product.name}
                          </div>

                          <div className="mt-1 text-xs text-muted-foreground">
                            {product.barcode
                              ? `Código: ${product.barcode}`
                              : product.prepared
                                ? "Producto preparado"
                                : "Sin código de barras"}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-2">
                            <span>
                              {product.category?.icon ??
                                "📦"}
                            </span>

                            <span>
                              {product.category?.name ??
                                "Sin categoría"}
                            </span>
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <span
                            className={
                              product.stock === 0
                                ? "text-lg font-bold text-red-600"
                                : product.stock <=
                                    product.min_stock
                                  ? "text-lg font-bold text-amber-600"
                                  : "text-lg font-bold"
                            }
                          >
                            {formatNumber(product.stock)}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right text-muted-foreground">
                          {formatNumber(
                            product.min_stock
                          )}
                        </td>

                        <td className="px-5 py-4 text-center">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}
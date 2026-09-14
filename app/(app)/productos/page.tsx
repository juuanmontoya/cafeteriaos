"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = {
  id: string;
  name: string;
  icon: string | null;
};

type Product = {
  id: string;
  name: string;
  barcode: string | null;
  sale_price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  prepared: boolean;
  track_inventory: boolean;
  active: boolean;
  category_id: string | null;
};

type ProductWithCategory = Product & {
  category: Category | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ProductosPage() {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<ProductWithCategory | null>(null);

  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [minStock, setMinStock] = useState("0");
  const [trackInventory, setTrackInventory] = useState(true);
  const [prepared, setPrepared] = useState(false);
  const [active, setActive] = useState(true);

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
            sale_price,
            cost_price,
            stock,
            min_stock,
            prepared,
            track_inventory,
            active,
            category_id
          `
        )
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

  function resetForm() {
    setName("");
    setBarcode("");
    setCategoryId("");
    setSalePrice("");
    setCostPrice("");
    setStock("0");
    setMinStock("0");
    setTrackInventory(true);
    setPrepared(false);
    setActive(true);
    setFormError("");
    setEditingProduct(null);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    resetForm();
  }

  function openCreateForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(product: ProductWithCategory) {
    setEditingProduct(product);

    setName(product.name);
    setBarcode(product.barcode ?? "");
    setCategoryId(product.category_id ?? "");
    setSalePrice(String(product.sale_price));
    setCostPrice(String(product.cost_price));
    setMinStock(String(product.min_stock));
    setTrackInventory(product.track_inventory);
    setPrepared(product.prepared);
    setActive(product.active);

    setFormError("");
    setShowForm(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError("");

    if (!name.trim()) {
      setFormError("El nombre del producto es obligatorio.");
      return;
    }

    if (!categoryId) {
      setFormError("Selecciona una categoría.");
      return;
    }

    if (!salePrice || Number(salePrice) < 0) {
      setFormError("Ingresa un precio de venta válido.");
      return;
    }

    if (!costPrice || Number(costPrice) < 0) {
      setFormError("Ingresa un costo válido.");
      return;
    }

    if (Number(minStock) < 0) {
      setFormError("El stock mínimo no puede ser negativo.");
      return;
    }

    setSaving(true);

    const supabase = createClient();

    const productData = {
      name: name.trim(),
      barcode: barcode.trim() || null,
      category_id: categoryId,
      sale_price: Number(salePrice),
      cost_price: Number(costPrice),
      min_stock: trackInventory ? Number(minStock) : 0,
      track_inventory: trackInventory,
      prepared,
      active,
    };

    let result;

    if (editingProduct) {
      result = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingProduct.id);
    } else {
      result = await supabase
        .from("products")
        .insert({
          ...productData,
          stock: trackInventory ? Number(stock) : 0,
        });
    }

    if (result.error) {
      if (result.error.code === "23505") {
        setFormError(
          "Ya existe un producto con ese código de barras."
        );
      } else {
        setFormError(result.error.message);
      }

      setSaving(false);
      return;
    }

    await loadData();

    setSaving(false);
    setShowForm(false);
    resetForm();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Productos
          </h1>

          <p className="text-muted-foreground">
            Administra los productos y sus existencias.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          + Nuevo producto
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border bg-background shadow-sm">
          <div className="border-b p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {editingProduct
                    ? "Editar producto"
                    : "Nuevo producto"}
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  {editingProduct
                    ? "Actualiza la información del producto."
                    : "Registra un producto para venderlo en la cafetería."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 p-5">
            {formError && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="name"
                  className="text-sm font-medium"
                >
                  Nombre *
                </label>

                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ej. Empanada de carne"
                  className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="barcode"
                  className="text-sm font-medium"
                >
                  Código de barras
                </label>

                <input
                  id="barcode"
                  type="text"
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                  placeholder="Escanéalo o escríbelo"
                  className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                  disabled={saving}
                />

                <p className="text-xs text-muted-foreground">
                  Déjalo vacío para productos sin código.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="category"
                  className="text-sm font-medium"
                >
                  Categoría *
                </label>

                <select
                  id="category"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                  disabled={saving}
                >
                  <option value="">
                    Selecciona una categoría
                  </option>

                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon ? `${category.icon} ` : ""}
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="salePrice"
                  className="text-sm font-medium"
                >
                  Precio de venta *
                </label>

                <input
                  id="salePrice"
                  type="number"
                  min="0"
                  step="1"
                  value={salePrice}
                  onChange={(event) => setSalePrice(event.target.value)}
                  placeholder="Ej. 5000"
                  className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="costPrice"
                  className="text-sm font-medium"
                >
                  Costo *
                </label>

                <input
                  id="costPrice"
                  type="number"
                  min="0"
                  step="1"
                  value={costPrice}
                  onChange={(event) => setCostPrice(event.target.value)}
                  placeholder="Ej. 2500"
                  className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                  disabled={saving}
                />

                <p className="text-xs text-muted-foreground">
                  Lo que cuesta producir o comprar el producto.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="minStock"
                  className="text-sm font-medium"
                >
                  Stock mínimo
                </label>

                <input
                  id="minStock"
                  type="number"
                  min="0"
                  step="1"
                  value={minStock}
                  onChange={(event) => setMinStock(event.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                  disabled={saving || !trackInventory}
                />

                <p className="text-xs text-muted-foreground">
                  El sistema marcará el producto cuando llegue a este nivel.
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="space-y-4">
                <div>
                  <p className="font-medium">
                    Configuración
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Define cómo se comportará este producto.
                  </p>
                </div>

                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={trackInventory}
                    onChange={(event) =>
                      setTrackInventory(event.target.checked)
                    }
                    disabled={saving}
                    className="mt-1 h-4 w-4"
                  />

                  <span>
                    <span className="block text-sm font-medium">
                      Controlar inventario
                    </span>

                    <span className="block text-xs text-muted-foreground">
                      El stock disminuirá automáticamente cuando se venda.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={prepared}
                    onChange={(event) => setPrepared(event.target.checked)}
                    disabled={saving}
                    className="mt-1 h-4 w-4"
                  />

                  <span>
                    <span className="block text-sm font-medium">
                      Producto preparado
                    </span>

                    <span className="block text-xs text-muted-foreground">
                      Útil para empanadas, arepas, tintos y otros productos
                      preparados en la cafetería.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(event) => setActive(event.target.checked)}
                    disabled={saving}
                    className="mt-1 h-4 w-4"
                  />

                  <span>
                    <span className="block text-sm font-medium">
                      Producto activo
                    </span>

                    <span className="block text-xs text-muted-foreground">
                      Los productos inactivos no estarán disponibles para
                      nuevas ventas.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t pt-5">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg border px-4 py-2.5 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Guardando..."
                  : editingProduct
                    ? "Guardar cambios"
                    : "Guardar producto"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-background p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Productos
          </p>

          <p className="mt-2 text-2xl font-bold">
            {products.length}
          </p>
        </div>

        <div className="rounded-xl border bg-background p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Activos
          </p>

          <p className="mt-2 text-2xl font-bold">
            {products.filter((product) => product.active).length}
          </p>
        </div>

        <div className="rounded-xl border bg-background p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Stock bajo
          </p>

          <p className="mt-2 text-2xl font-bold">
            {
              products.filter(
                (product) =>
                  product.track_inventory &&
                  product.stock <= product.min_stock
              ).length
            }
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-background shadow-sm">
        <div className="border-b p-5">
          <h2 className="font-semibold">
            Catálogo de productos
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            {categories.length} categorías disponibles.
          </p>
        </div>

        {loading && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Cargando productos...
          </div>
        )}

        {!loading && error && (
          <div className="p-6">
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              Error: {error}
            </div>
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <div className="p-10 text-center">
            <div className="text-4xl">🥤</div>

            <h3 className="mt-3 font-semibold">
              Todavía no hay productos
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Crea el primer producto para comenzar a manejar el inventario.
            </p>
          </div>
        )}

        {!loading && !error && products.length > 0 && (
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

                  <th className="px-5 py-3 text-left font-medium">
                    Código
                  </th>

                  <th className="px-5 py-3 text-right font-medium">
                    Precio
                  </th>

                  <th className="px-5 py-3 text-right font-medium">
                    Stock
                  </th>

                  <th className="px-5 py-3 text-center font-medium">
                    Estado
                  </th>

                  <th className="px-5 py-3 text-right font-medium">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {products.map((product) => {
                  const lowStock =
                    product.track_inventory &&
                    product.stock <= product.min_stock;

                  return (
                    <tr
                      key={product.id}
                      className="border-b last:border-0"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium">
                          {product.name}
                        </div>

                        {product.prepared && (
                          <span className="mt-1 inline-block text-xs text-muted-foreground">
                            Preparado
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2">
                          <span>
                            {product.category?.icon ?? "📦"}
                          </span>

                          <span>
                            {product.category?.name ??
                              "Sin categoría"}
                          </span>
                        </span>
                      </td>

                      <td className="px-5 py-4 text-muted-foreground">
                        {product.barcode ?? "—"}
                      </td>

                      <td className="px-5 py-4 text-right font-medium">
                        {formatCurrency(product.sale_price)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        {!product.track_inventory ? (
                          <span className="text-muted-foreground">
                            No controla
                          </span>
                        ) : (
                          <span
                            className={
                              lowStock
                                ? "font-semibold text-red-600"
                                : "font-medium"
                            }
                          >
                            {product.stock}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span
                          className={
                            product.active
                              ? "inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700"
                              : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                          }
                        >
                          {product.active ? "Activo" : "Inactivo"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEditForm(product)}
                          className="inline-flex rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-muted"
                        >
                          Editar
                        </button>
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
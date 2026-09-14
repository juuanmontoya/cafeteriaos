"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = {
  id: string;
  name: string;
  icon: string | null;
};

export default function HomeClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCategories() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("categories")
        .select("id, name, icon")
        .order("name");

      if (error) {
        setError(error.message);
      } else {
        setCategories(data ?? []);
      }

      setLoading(false);
    }

    loadCategories();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-slate-900">
          ☕ CafeteríaOS
        </h1>

        <p className="mt-2 text-slate-600">
          Conexión con Supabase
        </p>

        <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Categorías
          </h2>

          {loading && (
            <p className="mt-4 text-slate-500">
              Cargando...
            </p>
          )}

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-4 text-red-700">
              Error: {error}
            </div>
          )}

          {!loading && !error && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <span className="text-2xl">
                    {category.icon}
                  </span>

                  <span className="ml-3 font-medium text-slate-800">
                    {category.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
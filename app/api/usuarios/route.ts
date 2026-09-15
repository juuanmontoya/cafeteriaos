import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan las variables de entorno de Supabase para administración."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

type SupervisorAuthResult =
  | {
      authorized: true;
      user: {
        id: string;
      };
      response: null;
    }
  | {
      authorized: false;
      user?: undefined;
      response: NextResponse;
    };

async function requireSupervisor(): Promise<SupervisorAuthResult> {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "No autenticado." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,name,role,active")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: error.message },
        { status: 500 }
      ),
    };
  }

  if (!profile || !profile.active || profile.role !== "supervisor") {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error:
            "No tienes permisos para administrar usuarios.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    user: {
      id: user.id,
    },
    response: null,
  };
}

export async function GET() {
  try {
    const auth = await requireSupervisor();

    if (!auth.authorized) {
      return auth.response;
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from("profiles")
      .select("id,name,role,active,created_at,updated_at")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      users: data ?? [],
    });
  } catch (error) {
    console.error("GET /api/usuarios:", error);

    return NextResponse.json(
      {
        error: "Error interno al consultar los usuarios.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSupervisor();

    if (!auth.authorized) {
      return auth.response;
    }

    let body: {
      name?: string;
      email?: string;
      password?: string;
      role?: "supervisor" | "encargado";
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Solicitud inválida." },
        { status: 400 }
      );
    }

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const role = body.role;

    if (!name) {
      return NextResponse.json(
        { error: "El nombre es obligatorio." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "El correo es obligatorio." },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        {
          error:
            "La contraseña debe tener al menos 6 caracteres.",
        },
        { status: 400 }
      );
    }

    if (role !== "supervisor" && role !== "encargado") {
      return NextResponse.json(
        { error: "El rol seleccionado no es válido." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
        },
      });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        {
          error:
            "Supabase no devolvió el usuario creado.",
        },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    const { data: profile, error: profileError } =
      await admin
        .from("profiles")
        .insert({
          id: userId,
          name,
          role,
          active: true,
        })
        .select(
          "id,name,role,active,created_at,updated_at"
        )
        .single();

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);

      return NextResponse.json(
        {
          error:
            "El usuario de autenticación fue creado, pero no se pudo crear su perfil. Se revirtió la creación.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        user: profile,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/usuarios:", error);

    return NextResponse.json(
      {
        error: "Error interno al crear el usuario.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSupervisor();

    if (!auth.authorized) {
      return auth.response;
    }

    let body: {
      userId?: string;
      name?: string;
      role?: "supervisor" | "encargado";
      active?: boolean;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Solicitud inválida." },
        { status: 400 }
      );
    }

    const userId = body.userId?.trim();

    if (!userId) {
      return NextResponse.json(
        { error: "Falta el ID del usuario." },
        { status: 400 }
      );
    }

    if (userId === auth.user.id && body.active === false) {
      return NextResponse.json(
        {
          error:
            "No puedes desactivar tu propio usuario.",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: currentProfile, error: currentError } =
      await admin
        .from("profiles")
        .select("id,name,role,active")
        .eq("id", userId)
        .maybeSingle();

    if (currentError) {
      return NextResponse.json(
        { error: currentError.message },
        { status: 500 }
      );
    }

    if (!currentProfile) {
      return NextResponse.json(
        { error: "El usuario no existe." },
        { status: 404 }
      );
    }

    const newRole =
      body.role !== undefined
        ? body.role
        : currentProfile.role;

    const newActive =
      body.active !== undefined
        ? body.active
        : currentProfile.active;

    if (
      newRole !== "supervisor" &&
      newRole !== "encargado"
    ) {
      return NextResponse.json(
        { error: "El rol seleccionado no es válido." },
        { status: 400 }
      );
    }

    /*
     * Evitamos dejar CafeteríaOS sin ningún
     * supervisor activo.
     */
    const removingSupervisor =
      currentProfile.role === "supervisor" &&
      currentProfile.active &&
      (newRole !== "supervisor" || !newActive);

    if (removingSupervisor) {
      const { count, error: countError } = await admin
        .from("profiles")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("role", "supervisor")
        .eq("active", true);

      if (countError) {
        return NextResponse.json(
          { error: countError.message },
          { status: 500 }
        );
      }

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          {
            error:
              "No puedes quitar este supervisor porque debe existir al menos un supervisor activo.",
          },
          { status: 400 }
        );
      }
    }

    const updates: {
      name?: string;
      role?: "supervisor" | "encargado";
      active?: boolean;
      updated_at?: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      const name = body.name.trim();

      if (!name) {
        return NextResponse.json(
          {
            error:
              "El nombre no puede quedar vacío.",
          },
          { status: 400 }
        );
      }

      updates.name = name;
    }

    if (body.role !== undefined) {
      updates.role = body.role;
    }

    if (body.active !== undefined) {
      updates.active = body.active;
    }

    const { data: profile, error } = await admin
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select(
        "id,name,role,active,created_at,updated_at"
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user: profile,
    });
  } catch (error) {
    console.error("PATCH /api/usuarios:", error);

    return NextResponse.json(
      {
        error:
          "Error interno al actualizar el usuario.",
      },
      { status: 500 }
    );
  }
}
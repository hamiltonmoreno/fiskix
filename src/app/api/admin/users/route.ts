import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("perfis")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin_fiskix") return null;
  return user;
}

const ALLOWED_ROLES = ["admin_fiskix", "diretor", "gestor_perdas", "supervisor", "fiscal"] as const;

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const { email, password, nome_completo, role, id_zona } = await request.json() as {
      email: string;
      password: string;
      nome_completo: string;
      role: string;
      id_zona?: string;
    };

    if (!email || !password || !nome_completo || !role) {
      return NextResponse.json({ error: "Campos obrigatórios em falta" }, { status: 400 });
    }

    if (!ALLOWED_ROLES.includes(role as typeof ALLOWED_ROLES[number])) {
      return NextResponse.json({ error: "Role inválido" }, { status: 400 });
    }

    const service = createServiceClient();
    const { error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome_completo, role, id_zona: id_zona || null },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const { id } = await request.json() as { id: string };
    if (!id) return NextResponse.json({ error: "ID do utilizador em falta" }, { status: 400 });

    const service = createServiceClient();
    const { error } = await service.auth.admin.deleteUser(id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

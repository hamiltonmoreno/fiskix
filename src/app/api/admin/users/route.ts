import { NextResponse } from "next/server";
import { z } from "zod";
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

const CreateUserSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Password deve ter pelo menos 8 caracteres"),
  nome_completo: z.string().min(1, "Nome obrigatório"),
  role: z.enum(ALLOWED_ROLES, { message: "Role inválido" }),
  id_zona: z.string().uuid("id_zona deve ser um UUID válido").optional().nullable(),
});

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });

    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }
    const { email, password, nome_completo, role, id_zona } = parsed.data;

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
    const body = await request.json().catch(() => null);
    const idParsed = z.object({ id: z.string().uuid("ID deve ser um UUID válido") }).safeParse(body);
    if (!idParsed.success) {
      return NextResponse.json({ error: idParsed.error.errors[0]?.message ?? "ID inválido" }, { status: 400 });
    }
    const { id } = idParsed.data;

    const service = createServiceClient();
    const { error } = await service.auth.admin.deleteUser(id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

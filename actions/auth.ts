"use server";

import { db } from "../db/index";
import { usuarios } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";

export async function fazerLogin(emailForm: string, senhaForm: string) {
  try {
    const usuarioBanco = await db
      .select()
      .from(usuarios)
      .where(and(eq(usuarios.email, emailForm), eq(usuarios.senha, senhaForm)))
      .get();

    if (usuarioBanco) {
      const cookieStore = await cookies();
      
      cookieStore.set("csiprc_session", JSON.stringify({ 
        id: usuarioBanco.id, 
        nome: usuarioBanco.nome, 
        role: usuarioBanco.role 
      }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      
      return { sucesso: true, role: usuarioBanco.role };
    } else {
      return { sucesso: false, erro: "E-mail ou senha incorretos." };
    }
  } catch (error) {
    console.error("Erro no login:", error);
    return { sucesso: false, erro: "Erro ao tentar conectar no banco." };
  }
}

export async function fazerLogout() {
  const cookieStore = await cookies();
  cookieStore.delete("csiprc_session");
  return { sucesso: true };
}

// === NOVA FUNÇÃO PARA O DASHBOARD LER QUEM ESTÁ LOGADO ===
export async function getSessao() {
  const cookieStore = await cookies();
  const session = cookieStore.get("csiprc_session");
  if (!session) return null;
  return JSON.parse(session.value);
}
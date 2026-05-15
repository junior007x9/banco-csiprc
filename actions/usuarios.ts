"use server";

import { db } from "../db/index";
import { usuarios } from "../db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// 1. Função para buscar todos os usuários (Para o Painel Admin)
export async function getUsuarios() {
  try {
    const dados = await db.select().from(usuarios);
    return dados;
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    return [];
  }
}

// 2. Função para criar um novo usuário (Para o Painel Admin)
export async function criarUsuario(dadosFormulario: any) {
  try {
    await db.insert(usuarios).values({
      nome: dadosFormulario.nome,
      email: dadosFormulario.email,
      senha: dadosFormulario.senha, // Atenção: em produção ideal usar bcrypt
      role: dadosFormulario.role,
      criadoEm: new Date().toISOString(),
    });

    revalidatePath("/admin"); // Vai atualizar a tela de admin
    return { sucesso: true };
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    return { sucesso: false, erro: "O e-mail já existe ou houve um erro no banco." };
  }
}

// 3. Função para Excluir um usuário
export async function excluirUsuario(id: number) {
  try {
    await db.delete(usuarios).where(eq(usuarios.id, id));
    revalidatePath("/admin");
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: "Erro ao excluir." };
  }
}
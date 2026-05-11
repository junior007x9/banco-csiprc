"use server";

import { db } from "../db/index";
import { adolescentes } from "../db/schema";
import { eq } from "drizzle-orm"; 
import { revalidatePath } from "next/cache";

export async function getAdolescentes() {
  try {
    const dados = await db.select().from(adolescentes);
    return dados;
  } catch (error) {
    console.error("Erro ao buscar adolescentes:", error);
    return [];
  }
}

export async function salvarAdolescente(dadosFormulario: any) {
  try {
    await db.insert(adolescentes).values({
      nomeCompleto: dadosFormulario.nomeCompleto,
      cpf: dadosFormulario.cpf, 
      foto: dadosFormulario.foto, // <-- SALVANDO A FOTO AQUI
      dataApreensao: dadosFormulario.dataApreensao,
      dataAdmissao: dadosFormulario.dataAdmissao,
      dataNascimento: dadosFormulario.dataNascimento,
      nomeResponsavel: dadosFormulario.nomeResponsavel,
      endereco: dadosFormulario.endereco,
      bairro: dadosFormulario.bairro,
      comarca: dadosFormulario.comarca,
      atoInfracional: dadosFormulario.atoInfracional,
      serieAnoEscolar: dadosFormulario.serieAnoEscolar,
      situacaoMedida: dadosFormulario.situacaoMedida,
      dataSaida: dadosFormulario.dataSaida, 
      destino: dadosFormulario.destino,     
      anoRegistro: Number(dadosFormulario.anoRegistro),
      criadoEm: new Date().toISOString(),
    });

    revalidatePath("/dashboard"); 
    return { sucesso: true };
  } catch (error) {
    console.error("Erro ao salvar:", error);
    return { sucesso: false, erro: "Falha ao salvar no banco de dados." };
  }
}

export async function atualizarAdolescente(id: number, dadosFormulario: any) {
    try {
      await db.update(adolescentes).set({
        nomeCompleto: dadosFormulario.nomeCompleto,
        cpf: dadosFormulario.cpf, 
        foto: dadosFormulario.foto, // <-- ATUALIZANDO A FOTO AQUI
        dataApreensao: dadosFormulario.dataApreensao,
        dataAdmissao: dadosFormulario.dataAdmissao,
        dataNascimento: dadosFormulario.dataNascimento,
        nomeResponsavel: dadosFormulario.nomeResponsavel,
        endereco: dadosFormulario.endereco,
        bairro: dadosFormulario.bairro,
        comarca: dadosFormulario.comarca,
        atoInfracional: dadosFormulario.atoInfracional,
        serieAnoEscolar: dadosFormulario.serieAnoEscolar,
        situacaoMedida: dadosFormulario.situacaoMedida,
        dataSaida: dadosFormulario.dataSaida, 
        destino: dadosFormulario.destino,     
        anoRegistro: Number(dadosFormulario.anoRegistro),
      }).where(eq(adolescentes.id, id));
  
      revalidatePath("/dashboard"); 
      return { sucesso: true };
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      return { sucesso: false, erro: "Falha ao atualizar no banco de dados." };
    }
}

export async function excluirAdolescente(id: number) {
    try {
      await db.delete(adolescentes).where(eq(adolescentes.id, id));
      revalidatePath("/dashboard"); 
      return { sucesso: true };
    } catch (error) {
      console.error("Erro ao excluir:", error);
      return { sucesso: false, erro: "Falha ao excluir no banco de dados." };
    }
}
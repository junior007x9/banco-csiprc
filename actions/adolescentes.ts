"use server";

import { db } from "../db/index";
import { adolescentes } from "../db/schema";
import { eq } from "drizzle-orm"; 
import { revalidatePath } from "next/cache";

// === FUNÇÃO AUXILIAR PARA FORÇAR CAIXA ALTA ===
const caixaAlta = (texto: any) => texto ? String(texto).toUpperCase().trim() : "";

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
      nomeCompleto: caixaAlta(dadosFormulario.nomeCompleto),
      cpf: dadosFormulario.cpf, 
      foto: dadosFormulario.foto, 
      dataApreensao: dadosFormulario.dataApreensao,
      dataAdmissao: dadosFormulario.dataAdmissao,
      dataNascimento: dadosFormulario.dataNascimento,
      nomeResponsavel: caixaAlta(dadosFormulario.nomeResponsavel),
      parentesco: caixaAlta(dadosFormulario.parentesco), 
      endereco: caixaAlta(dadosFormulario.endereco),
      bairro: caixaAlta(dadosFormulario.bairro),
      comarca: caixaAlta(dadosFormulario.comarca),
      atoInfracional: caixaAlta(dadosFormulario.atoInfracional),
      serieAnoEscolar: caixaAlta(dadosFormulario.serieAnoEscolar),
      situacaoMedida: caixaAlta(dadosFormulario.situacaoMedida),
      dataSaida: dadosFormulario.dataSaida, 
      destino: caixaAlta(dadosFormulario.destino),     
      anoRegistro: Number(dadosFormulario.anoRegistro),
      criadoEm: new Date().toISOString(),
      
      // === HISTÓRICO / AUDITORIA ===
      criadoPor: dadosFormulario.usuarioEditor || 'Desconhecido', 
      atualizadoPor: dadosFormulario.usuarioEditor || 'Desconhecido'
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
        nomeCompleto: caixaAlta(dadosFormulario.nomeCompleto),
        cpf: dadosFormulario.cpf, 
        foto: dadosFormulario.foto, 
        dataApreensao: dadosFormulario.dataApreensao,
        dataAdmissao: dadosFormulario.dataAdmissao,
        dataNascimento: dadosFormulario.dataNascimento,
        nomeResponsavel: caixaAlta(dadosFormulario.nomeResponsavel),
        parentesco: caixaAlta(dadosFormulario.parentesco),
        endereco: caixaAlta(dadosFormulario.endereco),
        bairro: caixaAlta(dadosFormulario.bairro),
        comarca: caixaAlta(dadosFormulario.comarca),
        atoInfracional: caixaAlta(dadosFormulario.atoInfracional),
        serieAnoEscolar: caixaAlta(dadosFormulario.serieAnoEscolar),
        situacaoMedida: caixaAlta(dadosFormulario.situacaoMedida),
        dataSaida: dadosFormulario.dataSaida, 
        destino: caixaAlta(dadosFormulario.destino),     
        anoRegistro: Number(dadosFormulario.anoRegistro),
        
        // === HISTÓRICO / AUDITORIA ===
        atualizadoPor: dadosFormulario.usuarioEditor || 'Desconhecido'
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

export async function importarAdolescentesCSV(listaAdolescentes: any[], usuarioEditor: string) {
    try {
        const dadosFormatados = listaAdolescentes.map(dadosFormulario => ({
            nomeCompleto: caixaAlta(dadosFormulario.nomeCompleto),
            cpf: "",
            foto: null,
            dataApreensao: dadosFormulario.dataApreensao || null,
            dataAdmissao: dadosFormulario.dataAdmissao || new Date().toISOString().split('T')[0], 
            dataNascimento: dadosFormulario.dataNascimento || '2000-01-01', 
            nomeResponsavel: caixaAlta(dadosFormulario.nomeResponsavel),
            parentesco: caixaAlta(dadosFormulario.parentesco),
            endereco: caixaAlta(dadosFormulario.endereco),
            bairro: caixaAlta(dadosFormulario.bairro),
            comarca: caixaAlta(dadosFormulario.comarca),
            atoInfracional: caixaAlta(dadosFormulario.atoInfracional),
            serieAnoEscolar: caixaAlta(dadosFormulario.serieAnoEscolar),
            situacaoMedida: caixaAlta(dadosFormulario.situacaoMedida || ""),
            dataSaida: dadosFormulario.dataSaida || null, 
            destino: caixaAlta(dadosFormulario.destino),     
            anoRegistro: Number(dadosFormulario.anoRegistro) || new Date().getFullYear(),
            criadoEm: new Date().toISOString(),
            
            // === HISTÓRICO / AUDITORIA ===
            criadoPor: usuarioEditor || 'Sistema',
            atualizadoPor: usuarioEditor || 'Sistema'
        }));

        await db.insert(adolescentes).values(dadosFormatados);
        
        revalidatePath("/dashboard"); 
        return { sucesso: true };
    } catch (error) {
        console.error("Erro na importação em massa:", error);
        return { sucesso: false, erro: "Falha ao importar registros no banco de dados." };
    }
}

// === NOVA FUNÇÃO: ZERAR TODO O BANCO ===
export async function zerarBancoDeDados() {
    try {
        // Deleta todos os registros da tabela de adolescentes sem filtro de ID
        await db.delete(adolescentes);
        revalidatePath("/dashboard"); 
        return { sucesso: true };
    } catch (error) {
        console.error("Erro ao zerar banco:", error);
        return { sucesso: false, erro: "Falha ao limpar o banco de dados." };
    }
}
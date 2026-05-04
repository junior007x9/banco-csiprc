import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// === TABELA DE ADOLESCENTES (Continua igual) ===
export const adolescentes = sqliteTable('adolescentes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  anoRegistro: integer('ano_registro').notNull(),
  
  nomeCompleto: text('nome_completo').notNull(), 
  dataApreensao: text('data_apreensao'),         
  dataAdmissao: text('data_admissao').notNull(), 
  dataNascimento: text('data_nascimento').notNull(), 
  nomeResponsavel: text('nome_responsavel'),     
  endereco: text('endereco'),                    
  bairro: text('bairro'),                        
  comarca: text('comarca'),                      
  atoInfracional: text('ato_infracional'),       
  serieAnoEscolar: text('serie_ano_escolar'),    
  situacaoMedida: text('situacao_medida'),       
  dataSaida: text('data_saida'),                 
  destino: text('destino'),                      
  
  criadoEm: text('criado_em')
});

// === NOVA TABELA DE USUÁRIOS ===
export const usuarios = sqliteTable('usuarios', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(), // O email não pode se repetir
  senha: text('senha').notNull(), // Em um sistema real a senha seria criptografada
  role: text('role').notNull().default('comum'), // Pode ser 'admin' ou 'comum'
  criadoEm: text('criado_em')
});
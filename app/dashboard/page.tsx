"use client";

import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { getAdolescentes, salvarAdolescente, atualizarAdolescente, excluirAdolescente } from "../../actions/adolescentes";
import { getSessao, fazerLogout } from "../../actions/auth";

const calcularIdade = (dataNascimento: string) => {
  if (!dataNascimento) return 0;
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
};

const formatarData = (dataString: string | null | undefined) => {
  if (!dataString) return "";
  try {
    return new Date(dataString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  } catch {
    return "";
  }
};

export default function Dashboard() {
  const [busca, setBusca] = useState("");
  const [anoFiltro, setAnoFiltro] = useState("Todos");
  
  // === NOVOS CONTROLES DA MODAL ===
  const [modoModal, setModoModal] = useState<'fechado' | 'novo' | 'ver' | 'editar'>('fechado');
  const [jovemSelecionado, setJovemSelecionado] = useState<any>(null);

  const [dados, setDados] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [exportandoExcel, setExportandoExcel] = useState(false);
  
  // Controle de Permissão do Usuário Logado
  const [usuarioNome, setUsuarioNome] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const carregarDados = async () => {
    setCarregando(true);
    // Puxa os dados E a sessão do usuário ao mesmo tempo
    const [dadosReais, sessao] = await Promise.all([getAdolescentes(), getSessao()]);
    setDados(dadosReais);
    
    if (sessao) {
      setUsuarioNome(sessao.nome);
      setIsAdmin(sessao.role === 'admin');
    }
    setCarregando(false);
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const dadosFiltrados = dados.filter((jovem) => {
    const matchNome = jovem.nomeCompleto?.toLowerCase().includes(busca.toLowerCase());
    const matchAno = anoFiltro === "Todos" || jovem.anoRegistro?.toString() === anoFiltro;
    return matchNome && matchAno;
  });

  // === ABRIR MODAL (Ver, Editar ou Novo) ===
  const abrirModal = (modo: 'novo' | 'ver' | 'editar', jovem: any = null) => {
    setJovemSelecionado(jovem);
    setModoModal(modo);
  };

  // === EXCLUIR REGISTRO ===
  const handleExcluir = async (id: number) => {
    if (confirm("ATENÇÃO: Tem certeza que deseja excluir permanentemente este adolescente do banco de dados?")) {
      const res = await excluirAdolescente(id);
      if (res.sucesso) carregarDados();
      else alert("Erro ao excluir: " + res.erro);
    }
  };

  // === SALVAR OU ATUALIZAR REGISTRO ===
  const handleSalvar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSalvando(true);

    const formData = new FormData(e.currentTarget);
    const dadosFormulario = Object.fromEntries(formData.entries());

    let resultado;
    if (modoModal === 'editar' && jovemSelecionado) {
      resultado = await atualizarAdolescente(jovemSelecionado.id, dadosFormulario);
    } else {
      resultado = await salvarAdolescente(dadosFormulario);
    }

    if (resultado.sucesso) {
      setModoModal('fechado');
      carregarDados(); 
    } else {
      alert("Erro ao salvar: " + resultado.erro);
    }
    setSalvando(false);
  };

  // Logística de Logout
  const sair = async () => {
      await fazerLogout();
      window.location.href = '/';
  }

  // === CÓDIGOS DE EXPORTAÇÃO (MANTIDOS INTACTOS) ===
  const exportarParaPDF = () => {
    if (dadosFiltrados.length === 0) return alert("Sem dados para exportar.");
    const doc = new jsPDF('landscape'); 
    doc.setFontSize(18);
    doc.text("Relatório de Adolescentes - CSIPRC", 14, 20);
    doc.setFontSize(10);
    doc.text(`Filtro atual: ${anoFiltro} | Registros: ${dadosFiltrados.length}`, 14, 28);

    const tableData = dadosFiltrados.map((jovem, index) => [
      index + 1, jovem.nomeCompleto || "", formatarData(jovem.dataApreensao), formatarData(jovem.dataAdmissao),
      formatarData(jovem.dataNascimento), calcularIdade(jovem.dataNascimento), jovem.nomeResponsavel || "",
      jovem.endereco || "", jovem.bairro || "", jovem.comarca || "", jovem.atoInfracional || "",
      jovem.serieAnoEscolar || "", jovem.situacaoMedida || "", formatarData(jovem.dataSaida), jovem.destino || ""
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Nº', 'NOME', 'DATA APREENSÃO', 'DATA ADMISSÃO', 'D.N.', 'IDADE', 'RESPONSÁVEL', 'ENDEREÇO', 'BAIRRO', 'COMARCA', 'ATO INFRACIONAL', 'SÉRIE/ ANO', 'SITUAÇÃO/ MEDIDA', 'DATA SAÍDA', 'DESTINO']],
      body: tableData, theme: 'grid', headStyles: { fillColor: [37, 99, 235], fontSize: 6 }, styles: { fontSize: 6, cellPadding: 1 }, 
    });
    doc.save(`relatorio_csiprc_${anoFiltro}.pdf`);
  };

  const exportarParaExcel = async () => {
    if (dadosFiltrados.length === 0) return alert("Sem dados para exportar.");
    setExportandoExcel(true);
    try {
      const response = await fetch('/molde.xlsx');
      if (!response.ok) throw new Error("Arquivo 'molde.xlsx' não encontrado na pasta public.");
      const arrayBuffer = await response.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.worksheets[0]; 

      let linhaAtual = 3;
      dadosFiltrados.forEach((jovem, index) => {
        const row = worksheet.getRow(linhaAtual);
        row.getCell(1).value = index + 1; row.getCell(2).value = jovem.nomeCompleto || ""; row.getCell(3).value = formatarData(jovem.dataApreensao);
        row.getCell(4).value = formatarData(jovem.dataAdmissao); row.getCell(5).value = formatarData(jovem.dataNascimento); row.getCell(6).value = calcularIdade(jovem.dataNascimento);
        row.getCell(7).value = jovem.nomeResponsavel || ""; row.getCell(8).value = jovem.endereco || ""; row.getCell(9).value = jovem.bairro || "";
        row.getCell(10).value = jovem.comarca || ""; row.getCell(11).value = jovem.atoInfracional || ""; row.getCell(12).value = jovem.serieAnoEscolar || "";
        row.getCell(13).value = jovem.situacaoMedida || ""; row.getCell(14).value = formatarData(jovem.dataSaida); row.getCell(15).value = jovem.destino || "";
        row.commit(); linhaAtual++;
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `BANCO_DE_DADOS_CSIPRC_${anoFiltro}.xlsx`; a.click(); window.URL.revokeObjectURL(url);
    } catch (error) {
      alert("Erro ao gerar o Excel.");
    }
    setExportandoExcel(false);
  };

  const compartilharWhatsApp = () => {
    if (dadosFiltrados.length === 0) return alert("Sem dados para exportar.");
    let texto = `*BANCO DE DADOS CSIPRC*\nFiltro: ${anoFiltro} | Total: ${dadosFiltrados.length} registros\n\n`;
    for (let i = 0; i < Math.min(dadosFiltrados.length, 15); i++) {
      const j = dadosFiltrados[i];
      texto += `*Nº ${i + 1} - ${j.nomeCompleto}* (${calcularIdade(j.dataNascimento)} anos)\n├ Admissão: ${formatarData(j.dataAdmissao)}\n├ Ato Infracional: ${j.atoInfracional || 'Não inf.'}\n└ Medida: ${j.situacaoMedida || 'Não inf.'}\n\n`;
    }
    if (dadosFiltrados.length > 15) texto += `...e mais ${dadosFiltrados.length - 15} adolescentes.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans relative">
        <header className="bg-white shadow-sm border-b border-slate-200 px-8 py-4 flex justify-between items-center relative z-10">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/30">
                    <span className="text-white font-bold text-lg">CS</span>
                </div>
                <h1 className="text-xl font-bold text-slate-800">Painel CSIPRC</h1>
            </div>
            <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-500 hidden sm:block">Logado como: <b>{usuarioNome || "Usuário"}</b></span>
                {isAdmin && (
                   <button onClick={() => window.location.href = '/admin'} className="text-sm text-blue-600 font-bold hover:underline border-r border-slate-300 pr-4 mr-1">Painel Admin</button>
                )}
                <button onClick={sair} className="text-sm text-red-600 font-bold hover:underline">Sair</button>
            </div>
        </header>

        <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Registros de Adolescentes</h2>
                    <p className="text-slate-500 text-sm mt-1">Gerencie, filtre e exporte os dados do sistema.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={exportarParaPDF} className="flex items-center justify-center gap-2 bg-red-50 text-red-600 px-4 py-2.5 rounded-xl font-bold border border-red-200 hover:bg-red-100 transition-all shadow-sm">📄 <span className="hidden sm:inline">PDF</span></button>
                    <button onClick={exportarParaExcel} disabled={exportandoExcel} className="flex items-center justify-center gap-2 bg-green-50 text-green-700 px-4 py-2.5 rounded-xl font-bold border border-green-200 hover:bg-green-100 transition-all shadow-sm disabled:opacity-50">📊 <span className="hidden sm:inline">{exportandoExcel ? "Gerando..." : "Excel"}</span></button>
                    <button onClick={compartilharWhatsApp} className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2.5 rounded-xl font-bold border border-emerald-200 hover:bg-emerald-100 transition-all shadow-sm">💬 <span className="hidden sm:inline">WhatsApp</span></button>
                    <button onClick={() => abrirModal('novo')} className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:-translate-y-0.5 transition-all w-full sm:w-auto mt-2 sm:mt-0">+ Novo Registro</button>
                </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Buscar por Nome</label>
                    <input type="text" placeholder="Digite o nome..." className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 transition-all" value={busca} onChange={(e) => setBusca(e.target.value)} />
                </div>
                <div className="w-full md:w-56">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Filtrar por Ano</label>
                    <select className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 transition-all" value={anoFiltro} onChange={(e) => setAnoFiltro(e.target.value)}>
                        <option value="Todos">Todos os Anos</option>
                        <option value="2026">2026</option>
                        <option value="2025">2025</option>
                        <option value="2024">2024</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                                <th className="p-4 font-bold uppercase tracking-wider text-xs">Nome Completo</th>
                                <th className="p-4 font-bold uppercase tracking-wider text-xs">Admissão</th>
                                <th className="p-4 font-bold uppercase tracking-wider text-xs">Idade</th>
                                <th className="p-4 font-bold uppercase tracking-wider text-xs">Ato Infracional</th>
                                <th className="p-4 font-bold uppercase tracking-wider text-xs">Situação/Medida</th>
                                <th className="p-4 font-bold uppercase tracking-wider text-xs text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {carregando ? (
                                <tr><td colSpan={6} className="p-8 text-center text-blue-600 font-bold">Carregando dados...</td></tr>
                            ) : dadosFiltrados.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-500">Nenhum registro encontrado.</td></tr>
                            ) : (
                              dadosFiltrados.map((jovem) => (
                                  <tr key={jovem.id} className="hover:bg-blue-50/50 transition-colors group">
                                      <td className="p-4 font-bold text-slate-800">{jovem.nomeCompleto}</td>
                                      <td className="p-4 text-slate-600 text-sm">{formatarData(jovem.dataAdmissao)}</td>
                                      <td className="p-4 text-slate-600 text-sm">
                                          <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-lg font-bold border border-slate-200">{calcularIdade(jovem.dataNascimento)} anos</span>
                                      </td>
                                      <td className="p-4 text-slate-600 text-sm font-medium">{jovem.atoInfracional}</td>
                                      <td className="p-4 text-slate-600 text-sm">
                                          <span className={`px-3 py-1 rounded-lg font-bold text-xs border ${jovem.situacaoMedida?.includes('Provisória') ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                              {jovem.situacaoMedida}
                                          </span>
                                      </td>
                                      <td className="p-4 text-right space-x-3">
                                          <button onClick={() => abrirModal('ver', jovem)} className="text-blue-600 font-bold text-sm hover:underline">Ver Ficha</button>
                                          
                                          {/* BOTÕES EXCLUSIVOS DO ADMIN */}
                                          {isAdmin && (
                                              <>
                                                <button onClick={() => abrirModal('editar', jovem)} className="text-amber-500 font-bold text-sm hover:underline">Editar</button>
                                                <button onClick={() => handleExcluir(jovem.id)} className="text-red-600 font-bold text-sm hover:underline">Excluir</button>
                                              </>
                                          )}
                                      </td>
                                  </tr>
                              ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>

        {/* === MODAL INTELIGENTE === */}
        {modoModal !== 'fechado' && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in-up">
                    
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                        <div>
                          <h3 className="text-xl font-bold text-slate-800">
                             {modoModal === 'novo' ? "Novo Registro" : modoModal === 'editar' ? "Editar Adolescente" : "Ficha Completa"}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                             {modoModal === 'ver' ? "Apenas leitura de dados." : "Preencha os dados conforme a planilha oficial."}
                          </p>
                        </div>
                        <button onClick={() => setModoModal('fechado')} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors font-bold">✕</button>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1">
                        {/* A propriedade 'key' força o formulário a recarregar as informações quando abrimos jovens diferentes */}
                        <form id="formCadastro" key={jovemSelecionado?.id || 'novo'} onSubmit={handleSalvar}>
                            {/* FIELDSET bloqueia tudo se for modo 'ver' */}
                            <fieldset disabled={modoModal === 'ver'} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                
                                <div className="col-span-full"><h4 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-2 border-b border-slate-100 pb-2">Identificação</h4></div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Nome (NOME)</label>
                                    <input type="text" name="nomeCompleto" defaultValue={jovemSelecionado?.nomeCompleto || ""} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Data Nasc. (D.N.)</label>
                                    <input type="date" name="dataNascimento" defaultValue={jovemSelecionado?.dataNascimento || ""} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Responsável (RESPONSÁVEL)</label>
                                    <input type="text" name="nomeResponsavel" defaultValue={jovemSelecionado?.nomeResponsavel || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Série/Ano (SÉRIE/ ANO)</label>
                                    <input type="text" name="serieAnoEscolar" defaultValue={jovemSelecionado?.serieAnoEscolar || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>

                                <div className="col-span-full mt-2"><h4 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-2 border-b border-slate-100 pb-2">Localização</h4></div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Endereço (ENDEREÇO)</label>
                                    <input type="text" name="endereco" defaultValue={jovemSelecionado?.endereco || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Bairro (BAIRRO)</label>
                                    <input type="text" name="bairro" defaultValue={jovemSelecionado?.bairro || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>
                                <div className="col-span-1 md:col-span-3">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Comarca (COMARCA)</label>
                                    <input type="text" name="comarca" defaultValue={jovemSelecionado?.comarca || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>

                                <div className="col-span-full mt-2"><h4 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-2 border-b border-slate-100 pb-2">Processo e Medida</h4></div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Ato Infracional</label>
                                    <input type="text" name="atoInfracional" defaultValue={jovemSelecionado?.atoInfracional || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Situação/Medida</label>
                                    <select name="situacaoMedida" defaultValue={jovemSelecionado?.situacaoMedida || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100">
                                        <option value="">Selecione...</option>
                                        <option value="Internação Provisória">Internação Provisória</option>
                                        <option value="Internação Estrita">Internação Estrita</option>
                                        <option value="Semiliberdade">Semiliberdade</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Ano de Registro (Filtro)</label>
                                    <input type="number" name="anoRegistro" defaultValue={jovemSelecionado?.anoRegistro || new Date().getFullYear()} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Data Apreensão</label>
                                    <input type="date" name="dataApreensao" defaultValue={jovemSelecionado?.dataApreensao || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Data Admissão</label>
                                    <input type="date" name="dataAdmissao" defaultValue={jovemSelecionado?.dataAdmissao || ""} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Data da Saída</label>
                                    <input type="date" name="dataSaida" defaultValue={jovemSelecionado?.dataSaida || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>
                                <div className="col-span-1 md:col-span-3">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Destino</label>
                                    <input type="text" name="destino" defaultValue={jovemSelecionado?.destino || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>

                            </fieldset>
                        </form>
                    </div>

                    {/* Rodapé Dinâmico */}
                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl shrink-0">
                        {modoModal === 'ver' ? (
                            <button onClick={() => setModoModal('fechado')} className="px-5 py-2.5 rounded-xl font-bold text-white bg-slate-600 hover:bg-slate-700 transition-colors">Fechar Ficha</button>
                        ) : (
                            <>
                              <button type="button" onClick={() => setModoModal('fechado')} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancelar</button>
                              <button type="submit" form="formCadastro" disabled={salvando} className="px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/30 transition-all disabled:opacity-70">
                                  {salvando ? "Processando..." : modoModal === 'editar' ? "Salvar Alterações" : "Salvar Registro"}
                              </button>
                            </>
                        )}
                    </div>

                </div>
            </div>
        )}
    </div>
  );
}
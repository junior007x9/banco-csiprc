"use client";

import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { getAdolescentes, salvarAdolescente, atualizarAdolescente, excluirAdolescente, importarAdolescentesCSV } from "../../actions/adolescentes";
import { getSessao, fazerLogout } from "../../actions/auth";

const CORES_GRAFICO = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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

const mascaraCPF = (valor: string) => {
  let v = valor.replace(/\D/g, "");
  if (v.length > 11) v = v.slice(0, 11);
  v = v.replace(/(\d{3})(\d)/, "$1.$2");
  v = v.replace(/(\d{3})(\d)/, "$1.$2");
  v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return v;
};

export default function Dashboard() {
  // === ESTADOS DOS FILTROS ===
  const [busca, setBusca] = useState("");
  const [anoFiltro, setAnoFiltro] = useState("Todos");
  const [comarcaFiltro, setComarcaFiltro] = useState("Todas");
  const [atoFiltro, setAtoFiltro] = useState("Todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  
  const [modoModal, setModoModal] = useState<'fechado' | 'novo' | 'ver' | 'editar'>('fechado');
  const [jovemSelecionado, setJovemSelecionado] = useState<any>(null);

  const [dados, setDados] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [exportandoExcel, setExportandoExcel] = useState(false);
  
  const [usuarioNome, setUsuarioNome] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);

  const carregarDados = async () => {
    setCarregando(true);
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

  // === OPÇÕES DINÂMICAS PARA OS FILTROS ===
  const comarcasUnicas = Array.from(new Set(dados.map(d => d.comarca).filter(Boolean))).sort();
  const atosUnicos = Array.from(new Set(dados.map(d => d.atoInfracional).filter(Boolean))).sort();

  // === LÓGICA DE FILTRAGEM MULTIPLA ===
  const dadosFiltrados = dados.filter((jovem) => {
    const matchNome = jovem.nomeCompleto?.toLowerCase().includes(busca.toLowerCase());
    const matchCpf = jovem.cpf?.includes(busca);
    const matchAno = anoFiltro === "Todos" || jovem.anoRegistro?.toString() === anoFiltro;
    const matchComarca = comarcaFiltro === "Todas" || jovem.comarca === comarcaFiltro;
    const matchAto = atoFiltro === "Todos" || jovem.atoInfracional === atoFiltro;
    
    let matchPeriodo = true;
    if (dataInicio || dataFim) {
        if (!jovem.dataAdmissao) {
            matchPeriodo = false;
        } else {
            const dataAdmissao = new Date(jovem.dataAdmissao);
            if (dataInicio && dataAdmissao < new Date(dataInicio)) matchPeriodo = false;
            if (dataFim && dataAdmissao > new Date(dataFim + 'T23:59:59')) matchPeriodo = false;
        }
    }

    return (matchNome || matchCpf) && matchAno && matchComarca && matchAto && matchPeriodo;
  });

  // === CÁLCULO DE ESTATÍSTICAS E GRÁFICOS ===
  const totalFiltrado = dadosFiltrados.length;
  
  const contagemPorAno = dadosFiltrados.reduce((acc, j) => {
      const ano = j.anoRegistro || 'Sem Ano';
      acc[ano] = (acc[ano] || 0) + 1;
      return acc;
  }, {} as Record<string, number>);

  const dadosGraficoComarca = Object.entries(
      dadosFiltrados.reduce((acc, j) => {
          const c = j.comarca || 'NÃO INFORMADA';
          acc[c] = (acc[c] || 0) + 1; return acc;
      }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

  const dadosGraficoAto = Object.entries(
      dadosFiltrados.reduce((acc, j) => {
          const a = j.atoInfracional || 'NÃO INFORMADO';
          acc[a] = (acc[a] || 0) + 1; return acc;
      }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name: name.length > 20 ? name.substring(0,20)+'...' : name, value, fullName: name })).sort((a, b) => b.value - a.value).slice(0, 5);

  // === SISTEMA DE ALERTAS (Prazo Vencendo) ===
  const alertasPrazo = dadosFiltrados.filter(j => {
      if (j.situacaoMedida?.includes('PROVISÓRIA') && !j.dataSaida && j.dataAdmissao) {
          const dias = Math.floor((new Date().getTime() - new Date(j.dataAdmissao).getTime()) / (1000 * 3600 * 24));
          return dias >= 40; 
      }
      return false;
  });

  // === FUNÇÕES DO MODAL E CRUD ===
  const abrirModal = (modo: 'novo' | 'ver' | 'editar', jovem: any = null) => {
    setJovemSelecionado(jovem);
    setFotoBase64(jovem?.foto || null); 
    setModoModal(modo);
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoBase64(reader.result as string); 
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImportarArquivoCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsText(file, 'windows-1252');
    reader.onload = async (evento) => {
        const texto = evento.target?.result as string;
        const delimitador = texto.includes(';') ? ';' : ',';
        const linhas = texto.split(/\r?\n/).filter(l => l.trim() !== '');
        
        if (linhas.length <= 1) return alert("Arquivo CSV vazio ou sem dados válidos.");

        const formatarDataCSV = (dataStr: string) => {
            if (!dataStr) return "";
            if (dataStr.includes('/')) {
                const [dia, mes, ano] = dataStr.split('/');
                if(ano && ano.length === 4) return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
            }
            return dataStr.includes('-') ? dataStr : "";
        };

        const listaMassa = [];
        for (let i = 1; i < linhas.length; i++) {
            const regexSeparador = delimitador === ';' ? /;(?=(?:(?:[^"]*"){2})*[^"]*$)/ : /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
            const colunas = linhas[i].split(regexSeparador).map(c => c.replace(/^"|"$/g, '').trim());

            if (colunas.length >= 2 && colunas[0]) {
                listaMassa.push({
                    nomeCompleto: colunas[0],
                    dataNascimento: formatarDataCSV(colunas[1]),
                    nomeResponsavel: colunas[2] || "",
                    parentesco: colunas[3] || "",
                    serieAnoEscolar: colunas[4] || "",
                    endereco: colunas[5] || "",
                    bairro: colunas[6] || "",
                    comarca: colunas[7] || "",
                    atoInfracional: colunas[8] || "",
                    anoRegistro: colunas[9] || new Date().getFullYear(),
                    dataApreensao: formatarDataCSV(colunas[10]),
                    dataAdmissao: formatarDataCSV(colunas[11]),
                    dataSaida: formatarDataCSV(colunas[12]),
                    destino: colunas[13] || "",
                });
            }
        }

        if (confirm(`Foram identificados ${listaMassa.length} registros. Confirmar importação?`)) {
            setCarregando(true);
            const resultado = await importarAdolescentesCSV(listaMassa);
            if (resultado.sucesso) {
                alert("Sucesso! Todos os registros foram importados.");
                carregarDados();
            } else {
                alert("Erro durante a importação: " + resultado.erro);
            }
            setCarregando(false);
        }
        e.target.value = "";
    };
  };

  const handleExcluir = async (id: number) => {
    if (confirm("ATENÇÃO: Tem certeza que deseja excluir permanentemente este adolescente do banco de dados?")) {
      const res = await excluirAdolescente(id);
      if (res.sucesso) carregarDados();
      else alert("Erro ao excluir: " + res.erro);
    }
  };

  const handleSalvar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSalvando(true);
    const formData = new FormData(e.currentTarget);
    const dadosBrutos = Object.fromEntries(formData.entries());
    const dadosFormulario = { ...dadosBrutos, foto: fotoBase64 || "" };

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

  const sair = async () => { await fazerLogout(); window.location.href = '/'; }

  // === FUNÇÕES DE EXPORTAÇÃO ===
  const exportarFichaIndividualPDF = () => {
    if (!jovemSelecionado) return;
    const doc = new jsPDF();
    
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("FICHA DO ADOLESCENTE", 105, 18, { align: "center" });
    doc.setFontSize(10);
    doc.text("Centro Socioeducativo de Internação Provisória - CSIPRC", 105, 25, { align: "center" });

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);

    if (jovemSelecionado.foto) {
        doc.addImage(jovemSelecionado.foto, 'JPEG', 150, 40, 40, 53);
    } else {
        doc.setDrawColor(200); doc.rect(150, 40, 40, 53); doc.text("Sem Foto", 170, 68, { align: "center" });
    }

    doc.setFont('', 'bold'); doc.text("IDENTIFICAÇÃO", 14, 45);
    doc.setFont('', 'normal');
    doc.text(`Nome: ${jovemSelecionado.nomeCompleto}`, 14, 55);
    doc.text(`CPF: ${jovemSelecionado.cpf || 'Não informado'}`, 14, 62);
    doc.text(`Data de Nascimento: ${formatarData(jovemSelecionado.dataNascimento)} (${calcularIdade(jovemSelecionado.dataNascimento)} anos)`, 14, 69);
    doc.text(`Série/Ano Escolar: ${jovemSelecionado.serieAnoEscolar || '-'}`, 14, 76);
    doc.text(`Responsável: ${jovemSelecionado.nomeResponsavel || '-'} (${jovemSelecionado.parentesco || '-'})`, 14, 83);

    doc.setFont('', 'bold'); doc.text("LOCALIZAÇÃO", 14, 100);
    doc.setFont('', 'normal');
    doc.text(`Endereço: ${jovemSelecionado.endereco || '-'}`, 14, 110);
    doc.text(`Bairro: ${jovemSelecionado.bairro || '-'}`, 14, 117);
    doc.text(`Comarca: ${jovemSelecionado.comarca || '-'}`, 14, 124);

    doc.setFont('', 'bold'); doc.text("PROCESSO E MEDIDA", 14, 140);
    doc.setFont('', 'normal');
    doc.text(`Ato Infracional: ${jovemSelecionado.atoInfracional || '-'}`, 14, 150);
    doc.text(`Situação/Medida: ${jovemSelecionado.situacaoMedida || '-'}`, 14, 157);
    doc.text(`Data de Apreensão: ${formatarData(jovemSelecionado.dataApreensao) || '-'}`, 14, 164);
    doc.text(`Data de Admissão: ${formatarData(jovemSelecionado.dataAdmissao) || '-'}`, 14, 171);
    doc.text(`Data de Saída: ${formatarData(jovemSelecionado.dataSaida) || '-'}`, 14, 178);
    doc.text(`Destino: ${jovemSelecionado.destino || '-'}`, 14, 185);

    doc.save(`Ficha_${jovemSelecionado.nomeCompleto.replace(/\s+/g, '_')}.pdf`);
  };

  const exportarParaPDF = () => {
    if (dadosFiltrados.length === 0) return alert("Sem dados para exportar.");
    const doc = new jsPDF('landscape'); 
    doc.setFontSize(18);
    doc.text("Relatório de Adolescentes - CSIPRC", 14, 20);
    doc.setFontSize(10);
    doc.text(`Filtro atual: ${totalFiltrado} registros encontrados.`, 14, 28);

    const tableData = dadosFiltrados.map((jovem, index) => [
      index + 1, jovem.nomeCompleto || "", jovem.cpf || "", formatarData(jovem.dataApreensao), formatarData(jovem.dataAdmissao),
      formatarData(jovem.dataNascimento), calcularIdade(jovem.dataNascimento), jovem.nomeResponsavel || "", jovem.parentesco || "",
      jovem.endereco || "", jovem.bairro || "", jovem.comarca || "", jovem.atoInfracional || "",
      jovem.serieAnoEscolar || "", jovem.situacaoMedida || "", formatarData(jovem.dataSaida), jovem.destino || ""
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Nº', 'NOME', 'CPF', 'APREENSÃO', 'ADMISSÃO', 'D.N.', 'IDADE', 'RESPONSÁVEL', 'PARENTESCO', 'ENDEREÇO', 'BAIRRO', 'COMARCA', 'ATO INFRACIONAL', 'SÉRIE/ ANO', 'MEDIDA', 'DATA SAÍDA', 'DESTINO']],
      body: tableData, theme: 'grid', headStyles: { fillColor: [37, 99, 235], fontSize: 5 }, styles: { fontSize: 5, cellPadding: 1 }, 
    });
    doc.save(`relatorio_csiprc.pdf`);
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
        row.getCell(1).value = index + 1; 
        row.getCell(2).value = jovem.nomeCompleto || ""; 
        row.getCell(3).value = jovem.cpf || ""; 
        row.getCell(4).value = formatarData(jovem.dataApreensao);
        row.getCell(5).value = formatarData(jovem.dataAdmissao); 
        row.getCell(6).value = formatarData(jovem.dataNascimento); 
        row.getCell(7).value = calcularIdade(jovem.dataNascimento);
        row.getCell(8).value = jovem.nomeResponsavel || ""; 
        row.getCell(9).value = jovem.parentesco || "";
        row.getCell(10).value = jovem.endereco || ""; 
        row.getCell(11).value = jovem.bairro || "";
        row.getCell(12).value = jovem.comarca || ""; 
        row.getCell(13).value = jovem.atoInfracional || ""; 
        row.getCell(14).value = jovem.serieAnoEscolar || "";
        row.getCell(15).value = jovem.situacaoMedida || ""; 
        row.getCell(16).value = formatarData(jovem.dataSaida); 
        row.getCell(17).value = jovem.destino || "";
        row.commit(); linhaAtual++;
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `BANCO_DE_DADOS_CSIPRC.xlsx`; a.click(); window.URL.revokeObjectURL(url);
    } catch (error) { alert("Erro ao gerar o Excel."); }
    setExportandoExcel(false);
  };

  const compartilharWhatsApp = () => {
    if (dadosFiltrados.length === 0) return alert("Sem dados para exportar.");
    let texto = `*BANCO DE DADOS CSIPRC*\nTotal Selecionado: ${totalFiltrado} registros\n\n`;
    for (let i = 0; i < Math.min(dadosFiltrados.length, 15); i++) {
      const j = dadosFiltrados[i];
      texto += `*Nº ${i + 1} - ${j.nomeCompleto}* (${calcularIdade(j.dataNascimento)} anos)\n├ CPF: ${j.cpf || 'Não inf.'}\n├ Admissão: ${formatarData(j.dataAdmissao)}\n└ Medida: ${j.situacaoMedida || 'Não inf.'}\n\n`;
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
            
            {/* === CABEÇALHO COM BOTÕES DE AÇÃO === */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Registros e Estatísticas</h2>
                    <p className="text-slate-500 text-sm mt-1">Gerencie e analise os dados do sistema em tempo real.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={exportarParaPDF} className="flex items-center justify-center gap-2 bg-red-50 text-red-600 px-4 py-2.5 rounded-xl font-bold border border-red-200 hover:bg-red-100 transition-all shadow-sm">📄 <span className="hidden sm:inline">PDF</span></button>
                    <button onClick={exportarParaExcel} disabled={exportandoExcel} className="flex items-center justify-center gap-2 bg-green-50 text-green-700 px-4 py-2.5 rounded-xl font-bold border border-green-200 hover:bg-green-100 transition-all shadow-sm disabled:opacity-50">📊 <span className="hidden sm:inline">{exportandoExcel ? "Gerando..." : "Excel"}</span></button>
                    <button onClick={compartilharWhatsApp} className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2.5 rounded-xl font-bold border border-emerald-200 hover:bg-emerald-100 transition-all shadow-sm">💬 <span className="hidden sm:inline">WhatsApp</span></button>
                    <label className="flex items-center justify-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-purple-500/30 hover:bg-purple-700 hover:-translate-y-0.5 transition-all w-full sm:w-auto mt-2 sm:mt-0 cursor-pointer">
                        📥 Importar CSV
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportarArquivoCSV} />
                    </label>
                    <button onClick={() => abrirModal('novo')} className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:-translate-y-0.5 transition-all w-full sm:w-auto mt-2 sm:mt-0">+ Novo Registro</button>
                </div>
            </div>

            {/* === ALERTAS DE PRAZO === */}
            {alertasPrazo.length > 0 && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-2xl shadow-sm flex items-start gap-4 animate-pulse">
                    <div className="text-red-500 text-3xl">⚠️</div>
                    <div>
                        <h3 className="text-red-800 font-bold">Atenção: Prazos Críticos (Acima de 40 dias)</h3>
                        <p className="text-red-600 text-sm">Existem {alertasPrazo.length} adolescente(s) em Internação Provisória aproximando-se ou excedendo o limite de 45 dias.</p>
                    </div>
                </div>
            )}

            {/* === PAINEL DE ESTATÍSTICAS E GRÁFICOS === */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Card Total e Por Ano */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Total de Registros</h3>
                    <div className="text-4xl font-black text-blue-600 mb-4">{totalFiltrado}</div>
                    <div className="space-y-1">
                        {Object.entries(contagemPorAno).sort((a: any, b: any)=>Number(b[0])-Number(a[0])).slice(0,4).map(([ano, qtd]) => (
                            <div key={ano} className="flex justify-between text-sm text-slate-600 border-t border-slate-100 pt-1">
                                <span>Ano {ano}</span><span className="font-bold">{String(qtd)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Gráfico Comarcas */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 w-full text-left">Top 5 Comarcas</h3>
                    <div className="w-full h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={dadosGraficoComarca} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" stroke="none">
                                    {dadosGraficoComarca.map((_, index) => <Cell key={`cell-${index}`} fill={CORES_GRAFICO[index % CORES_GRAFICO.length]} />)}
                                </Pie>
                                <RechartsTooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Gráfico Atos Infracionais */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 w-full text-left">Atos Infracionais</h3>
                    <div className="w-full h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dadosGraficoAto} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} />
                                <RechartsTooltip />
                                <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* === ÁREA DE FILTROS AVANÇADOS === */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Filtros de Pesquisa Avançada</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    
                    <div className="lg:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Buscar Nome/CPF</label>
                        <input type="text" placeholder="Digite..." className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50" value={busca} onChange={(e) => setBusca(e.target.value)} />
                    </div>
                    
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Ano do Registro</label>
                        <select className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50" value={anoFiltro} onChange={(e) => setAnoFiltro(e.target.value)}>
                            <option value="Todos">Todos os Anos</option>
                            <option value="2026">2026</option>
                            <option value="2025">2025</option>
                            <option value="2024">2024</option>
                            <option value="2023">2023</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Comarca</label>
                        <select className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50" value={comarcaFiltro} onChange={(e) => setComarcaFiltro(e.target.value)}>
                            <option value="Todas">Todas as Comarcas</option>
                            {comarcasUnicas.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Ato Infracional</label>
                        <select className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50" value={atoFiltro} onChange={(e) => setAtoFiltro(e.target.value)}>
                            <option value="Todos">Todos os Atos</option>
                            {atosUnicos.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>

                    <div className="lg:col-span-2 flex gap-2">
                        <div className="w-1/2">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Admissão (Início)</label>
                            <input type="date" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                        </div>
                        <div className="w-1/2">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Admissão (Fim)</label>
                            <input type="date" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                        </div>
                    </div>
                    
                    <div className="flex items-end lg:col-span-3">
                         <button onClick={() => { setBusca(""); setAnoFiltro("Todos"); setComarcaFiltro("Todas"); setAtoFiltro("Todos"); setDataInicio(""); setDataFim(""); }} className="px-4 py-2 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Limpar Filtros</button>
                    </div>

                </div>
            </div>

            {/* === TABELA DE RESULTADOS === */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                                <th className="p-4 font-bold uppercase tracking-wider text-xs">Nome Completo</th>
                                <th className="p-4 font-bold uppercase tracking-wider text-xs">CPF</th>
                                <th className="p-4 font-bold uppercase tracking-wider text-xs">Admissão</th>
                                <th className="p-4 font-bold uppercase tracking-wider text-xs">Idade</th>
                                <th className="p-4 font-bold uppercase tracking-wider text-xs">Situação/Medida</th>
                                <th className="p-4 font-bold uppercase tracking-wider text-xs text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {carregando ? (
                                <tr><td colSpan={6} className="p-8 text-center text-blue-600 font-bold">Carregando dados...</td></tr>
                            ) : dadosFiltrados.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-500">Nenhum registro encontrado para estes filtros.</td></tr>
                            ) : (
                              dadosFiltrados.map((jovem) => (
                                  <tr key={jovem.id} className="hover:bg-blue-50/50 transition-colors group">
                                      <td className="p-4 font-bold text-slate-800">{jovem.nomeCompleto}</td>
                                      <td className="p-4 text-slate-600 text-sm">{jovem.cpf || '-'}</td>
                                      <td className="p-4 text-slate-600 text-sm">{formatarData(jovem.dataAdmissao)}</td>
                                      <td className="p-4 text-slate-600 text-sm">
                                          <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-lg font-bold border border-slate-200">{calcularIdade(jovem.dataNascimento)} anos</span>
                                      </td>
                                      <td className="p-4 text-slate-600 text-sm">
                                          <span className={`px-3 py-1 rounded-lg font-bold text-xs border ${jovem.situacaoMedida?.includes('PROVISÓRIA') ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                              {jovem.situacaoMedida}
                                          </span>
                                      </td>
                                      <td className="p-4 text-right space-x-3">
                                          <button onClick={() => abrirModal('ver', jovem)} className="text-blue-600 font-bold text-sm hover:underline">Ver Ficha</button>
                                          
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

        {/* === MODAL DE CADASTRO/EDIÇÃO === */}
        {modoModal !== 'fechado' && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in-up">
                    
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                        <div>
                          <h3 className="text-xl font-bold text-slate-800">
                             {modoModal === 'novo' ? "Novo Registro" : modoModal === 'editar' ? "Editar Adolescente" : "Ficha Completa"}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 uppercase">
                             {modoModal === 'ver' ? "Apenas leitura de dados." : "Preencha os dados (o sistema salvará em caixa alta)."}
                          </p>
                        </div>
                        <button onClick={() => setModoModal('fechado')} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors font-bold">✕</button>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1">
                        <form id="formCadastro" key={jovemSelecionado?.id || 'novo'} onSubmit={handleSalvar}>
                            <fieldset disabled={modoModal === 'ver'} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                
                                <div className="col-span-full"><h4 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-2 border-b border-slate-100 pb-2">Identificação</h4></div>
                                
                                <div className="col-span-full flex flex-col md:flex-row gap-6 mb-2 items-start">
                                    <div className="flex flex-col items-center gap-3 w-full md:w-32 shrink-0">
                                        <div className="w-32 aspect-[3/4] overflow-hidden rounded-md border border-slate-300 bg-slate-100 shadow-sm">
                                            {fotoBase64 ? (
                                                <img src={fotoBase64} alt="Foto" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center w-full h-full text-slate-400 text-sm font-medium">
                                                    📷 Sem Foto
                                                </div>
                                            )}
                                        </div>
                                        {modoModal !== 'ver' && (
                                            <label className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold py-2 px-3 rounded-lg transition-colors text-center w-full shadow-sm">
                                                {fotoBase64 ? 'Trocar Foto' : 'Escolher Foto'}
                                                <input type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
                                            </label>
                                        )}
                                        {modoModal !== 'ver' && fotoBase64 && (
                                            <button type="button" onClick={() => setFotoBase64(null)} className="text-red-500 text-xs font-bold hover:underline">
                                                Remover
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                                        <div className="col-span-1 md:col-span-2">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Nome (NOME)</label>
                                            <input type="text" style={{ textTransform: 'uppercase' }} name="nomeCompleto" defaultValue={jovemSelecionado?.nomeCompleto || ""} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">CPF do Adolescente</label>
                                            <input type="text" name="cpf" maxLength={14} defaultValue={jovemSelecionado?.cpf || ""} onChange={(e) => e.target.value = mascaraCPF(e.target.value)} placeholder="000.000.000-00" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Data Nasc. (D.N.)</label>
                                            <input type="date" name="dataNascimento" defaultValue={jovemSelecionado?.dataNascimento || ""} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Responsável</label>
                                    <input type="text" style={{ textTransform: 'uppercase' }} name="nomeResponsavel" defaultValue={jovemSelecionado?.nomeResponsavel || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Parentesco</label>
                                    <input type="text" style={{ textTransform: 'uppercase' }} name="parentesco" placeholder="EX: MÃE, PAI..." defaultValue={jovemSelecionado?.parentesco || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Série/Ano Escolar</label>
                                    <input type="text" style={{ textTransform: 'uppercase' }} name="serieAnoEscolar" defaultValue={jovemSelecionado?.serieAnoEscolar || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>

                                <div className="col-span-full mt-2"><h4 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-2 border-b border-slate-100 pb-2">Localização</h4></div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Endereço</label>
                                    <input type="text" style={{ textTransform: 'uppercase' }} name="endereco" defaultValue={jovemSelecionado?.endereco || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Bairro</label>
                                    <input type="text" style={{ textTransform: 'uppercase' }} name="bairro" defaultValue={jovemSelecionado?.bairro || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>
                                <div className="col-span-1 md:col-span-3">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Comarca</label>
                                    <input type="text" style={{ textTransform: 'uppercase' }} name="comarca" defaultValue={jovemSelecionado?.comarca || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>

                                <div className="col-span-full mt-2"><h4 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-2 border-b border-slate-100 pb-2">Processo e Medida</h4></div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Ato Infracional</label>
                                    <input type="text" style={{ textTransform: 'uppercase' }} name="atoInfracional" defaultValue={jovemSelecionado?.atoInfracional || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Situação/Medida</label>
                                    <select name="situacaoMedida" defaultValue={jovemSelecionado?.situacaoMedida || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100">
                                        <option value="">SELECIONE...</option>
                                        <option value="ATENDIMENTO INICIAL">ATENDIMENTO INICIAL</option>
                                        <option value="INTERNAÇÃO PROVISÓRIA">INTERNAÇÃO PROVISÓRIA</option>
                                        <option value="ATENDIMENTO INICIAL E INTERNAÇÃO PROVISÓRIA">ATENDIMENTO INICIAL E INTERNAÇÃO PROVISÓRIA</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Ano de Registro</label>
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
                                    <input type="text" style={{ textTransform: 'uppercase' }} name="destino" defaultValue={jovemSelecionado?.destino || ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50 disabled:opacity-70 disabled:bg-slate-100" />
                                </div>

                            </fieldset>
                        </form>
                    </div>

                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl shrink-0">
                        {modoModal === 'ver' ? (
                            <>
                                <button onClick={exportarFichaIndividualPDF} className="px-5 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-md shadow-red-500/30">📄 Baixar Ficha PDF</button>
                                <button onClick={() => setModoModal('fechado')} className="px-5 py-2.5 rounded-xl font-bold text-white bg-slate-600 hover:bg-slate-700 transition-colors">Fechar</button>
                            </>
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
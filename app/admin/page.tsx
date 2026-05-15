"use client";

import { useState, useEffect } from "react";
import { getUsuarios, excluirUsuario, criarUsuario } from "../../actions/usuarios";
import { zerarBancoDeDados } from "../../actions/adolescentes"; // Importando a nova função
import { getSessao } from "../../actions/auth";

export default function AdminPage() {
    const [usuarios, setUsuarios] = useState<any[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [autorizado, setAutorizado] = useState(false);
    const [zerando, setZerando] = useState(false);
    
    // Estados do formulário
    const [nome, setNome] = useState("");
    const [email, setEmail] = useState("");
    const [senha, setSenha] = useState("");
    const [role, setRole] = useState("comum");

    const carregarUsuarios = async () => {
        setCarregando(true);
        const sessao = await getSessao();
        
        // Verifica se quem está a aceder é realmente um admin
        if (!sessao || sessao.role !== 'admin') {
            window.location.href = '/dashboard';
            return;
        }
        
        setAutorizado(true);
        const dados = await getUsuarios();
        setUsuarios(dados);
        setCarregando(false);
    };

    useEffect(() => { 
        carregarUsuarios(); 
    }, []);

    const handleSalvar = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await criarUsuario({ nome, email, senha, role });
        if (res.sucesso) {
            alert("Utilizador criado com sucesso!");
            setNome(""); 
            setEmail(""); 
            setSenha(""); 
            setRole("comum");
            carregarUsuarios();
        } else {
            alert("Erro: " + res.erro);
        }
    };

    const handleExcluir = async (id: number) => {
        if(confirm("Tem a certeza que deseja excluir este utilizador permanentemente? Ele perderá o acesso ao sistema.")) {
            await excluirUsuario(id);
            carregarUsuarios();
        }
    };

    // === FUNÇÃO PARA ZERAR O BANCO COM CONFIRMAÇÃO DUPLA ===
    const handleZerarBanco = async () => {
        const confirmacao = prompt("⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!\n\nPara excluir TODOS OS ADOLESCENTES cadastrados no banco de dados, digite a palavra: CONFIRMAR");
        
        if (confirmacao === "CONFIRMAR") {
            setZerando(true);
            const res = await zerarBancoDeDados();
            if (res.sucesso) {
                alert("Sucesso! Todos os registros de adolescentes foram apagados.");
            } else {
                alert("Erro ao zerar o banco: " + res.erro);
            }
            setZerando(false);
        } else if (confirmacao !== null) {
            alert("Palavra incorreta. A operação foi cancelada e nada foi apagado.");
        }
    };

    if (!autorizado) {
        return <div className="p-10 text-center font-bold text-slate-500 mt-20">A verificar permissões de administrador...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans">
            <div className="max-w-5xl mx-auto space-y-6">
                
                {/* CABEÇALHO */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Painel de Administração</h1>
                        <p className="text-slate-500 text-sm">Faça a gestão dos acessos e do banco de dados do sistema CSIPRC.</p>
                    </div>
                    <button onClick={() => window.location.href = '/dashboard'} className="px-5 py-2.5 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition-colors">
                        Voltar ao Dashboard
                    </button>
                </div>

                {/* FORMULÁRIO DE NOVO UTILIZADOR */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold text-blue-600 mb-4 border-b border-slate-100 pb-2">Adicionar Novo Utilizador</h2>
                    <form onSubmit={handleSalvar} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label>
                            <input required type="text" placeholder="Ex: João Silva" value={nome} onChange={(e)=>setNome(e.target.value)} className="w-full p-2.5 border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none rounded-lg bg-slate-50 text-sm" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email de Login</label>
                            <input required type="email" placeholder="nome@csiprc.com" value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full p-2.5 border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none rounded-lg bg-slate-50 text-sm" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Senha</label>
                            <input required type="text" placeholder="Defina a senha" value={senha} onChange={(e)=>setSenha(e.target.value)} className="w-full p-2.5 border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none rounded-lg bg-slate-50 text-sm" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Permissão</label>
                            <select value={role} onChange={(e)=>setRole(e.target.value)} className="w-full p-2.5 border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none rounded-lg bg-slate-50 text-sm font-semibold text-slate-700">
                                <option value="comum">COMUM (Visualizar/Editar)</option>
                                <option value="admin">ADMINISTRADOR (Total)</option>
                            </select>
                        </div>
                        <button type="submit" className="bg-blue-600 text-white font-bold px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/30">
                            Cadastrar
                        </button>
                    </form>
                </div>

                {/* TABELA DE UTILIZADORES */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
                                <tr className="border-b border-slate-200">
                                    <th className="p-4">Nome do Funcionário</th>
                                    <th className="p-4">Email</th>
                                    <th className="p-4">Perfil de Acesso</th>
                                    <th className="p-4 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {carregando ? (
                                    <tr><td colSpan={4} className="p-8 text-center font-bold text-blue-600">A carregar utilizadores...</td></tr>
                                ) : usuarios.length === 0 ? (
                                    <tr><td colSpan={4} className="p-8 text-center text-slate-500">Nenhum utilizador encontrado.</td></tr>
                                ) : (
                                 usuarios.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-bold text-slate-800">{u.nome}</td>
                                        <td className="p-4 text-slate-600 text-sm">{u.email}</td>
                                        <td className="p-4">
                                            <span className={`px-3 py-1 text-xs font-bold rounded-lg border ${u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                {u.role.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button onClick={() => handleExcluir(u.id)} className="text-red-600 font-bold text-sm hover:underline">
                                                Remover Acesso
                                            </button>
                                        </td>
                                    </tr>
                                )))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ZONA DE PERIGO */}
                <div className="bg-red-50 p-6 rounded-2xl shadow-sm border border-red-200 mt-12 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-black text-red-700 mb-1">⚠️ ZONA DE PERIGO: Zerar Banco de Dados</h2>
                        <p className="text-red-600 text-sm">Esta ação apagará <b>TODOS OS ADOLESCENTES</b> cadastrados no sistema. Os usuários administrativos serão mantidos.</p>
                    </div>
                    <button 
                        onClick={handleZerarBanco} 
                        disabled={zerando}
                        className="bg-red-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-500/30 whitespace-nowrap disabled:opacity-50"
                    >
                        {zerando ? "A APAGAR TUDO..." : "APAGAR TODOS OS REGISTROS"}
                    </button>
                </div>

            </div>
        </div>
    );
}
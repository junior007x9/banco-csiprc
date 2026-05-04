"use client";

import { useState, useEffect } from "react";
import { getUsuarios, criarUsuario, excluirUsuario } from "../../actions/usuarios";

export default function AdminPage() {
  const [listaUsuarios, setListaUsuarios] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = async () => {
    setCarregando(true);
    const dados = await getUsuarios();
    setListaUsuarios(dados);
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const handleSalvar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const dados = Object.fromEntries(formData.entries());

    const res = await criarUsuario(dados);
    if (res.sucesso) {
      alert("Usuário criado com sucesso!");
      (e.target as HTMLFormElement).reset(); // Limpa o formulário
      carregar();
    } else {
      alert(res.erro);
    }
  };

  const handleExcluir = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir este usuário?")) {
      await excluirUsuario(id);
      carregar();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-800">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Cabeçalho */}
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Painel do Administrador</h1>
            <p className="text-sm text-slate-500 mt-1">Gerencie quem tem acesso ao sistema CSIPRC.</p>
          </div>
          <button onClick={() => window.location.href = '/dashboard'} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200">
            Voltar ao Dashboard
          </button>
        </div>

        {/* Cadastro de Novo Usuário */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold mb-4 border-b border-slate-100 pb-2">Cadastrar Novo Usuário</h2>
          <form onSubmit={handleSalvar} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label>
              <input type="text" name="nome" required className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-600" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail (Login)</label>
              <input type="email" name="email" required className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-600" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Senha</label>
              <input type="password" name="senha" required className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-600" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nível</label>
              <select name="role" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-600">
                <option value="comum">Comum (Apenas ver/cadastrar)</option>
                <option value="admin">Administrador (Pode excluir)</option>
              </select>
            </div>
            <div className="md:col-span-4 flex justify-end mt-2">
              <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">
                + Salvar Usuário
              </button>
            </div>
          </form>
        </div>

        {/* Lista de Usuários Existentes */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
             <h2 className="text-lg font-bold">Usuários Cadastrados</h2>
          </div>
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold">Nome</th>
                <th className="p-4 font-bold">E-mail</th>
                <th className="p-4 font-bold">Nível</th>
                <th className="p-4 font-bold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {carregando ? (
                  <tr><td colSpan={4} className="p-8 text-center text-blue-600 font-bold">Carregando...</td></tr>
              ) : listaUsuarios.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-500">Nenhum usuário.</td></tr>
              ) : (
                listaUsuarios.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="p-4 font-bold text-slate-800">{u.nome}</td>
                    <td className="p-4 text-slate-600">{u.email}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs font-bold rounded-md ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => handleExcluir(u.id)} className="text-red-500 font-bold text-sm hover:underline">Excluir</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
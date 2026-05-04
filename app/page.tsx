"use client";

import { useState } from "react";
import { fazerLogin } from "../actions/auth"; // Puxando a nossa nova função

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErro(""); // Limpa erros antigos

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const senha = formData.get("senha") as string;
    
    // Chama a função real que vai no banco de dados do Turso
    const resultado = await fazerLogin(email, senha);

    if (resultado.sucesso) {
      // Se deu certo, redireciona para a tela do Dashboard!
      window.location.href = '/dashboard'; 
    } else {
      // Se errou a senha, mostra a mensagem na tela
      setErro(resultado.erro || "Falha ao acessar.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
        
        <div className="p-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
              <span className="text-white font-bold text-xl">CS</span>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-2">CSIPRC</h2>
          <p className="text-center text-slate-500 mb-6 font-medium">Acesso Restrito ao Sistema</p>
          
          {/* Mensagem de erro vermelha */}
          {erro && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm font-bold rounded-lg text-center">
              {erro}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email ou Usuário</label>
              <input 
                type="email" 
                name="email"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all bg-slate-50"
                placeholder="admin@csiprc.com.br"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Senha</label>
              <input 
                type="password" 
                name="senha"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all bg-slate-50"
                placeholder="••••••••"
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg hover:shadow-blue-600/40 flex justify-center items-center disabled:opacity-70"
            >
              {loading ? "Autenticando..." : "Entrar no Sistema"}
            </button>
          </form>
        </div>

        <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400 font-medium">
            Desenvolvido com alta segurança para dados sensíveis.
          </p>
        </div>
      </div>
    </div>
  );
}
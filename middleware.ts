import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Pega o cookie (crachá) do usuário
  const session = request.cookies.get('csiprc_session');

  const rotaAtual = request.nextUrl.pathname;

  // 1. Se tentar entrar no Dashboard ou Admin SEM estar logado -> Expulsa pro Login
  if (rotaAtual.startsWith('/dashboard') || rotaAtual.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // 2. Se a pessoa já estiver logada e tentar ir pra tela de Login -> Manda pro Dashboard
  if (rotaAtual === '/') {
     if (session) {
         return NextResponse.redirect(new URL('/dashboard', request.url));
     }
  }

  return NextResponse.next();
}

// Configura quais pastas o segurança tem que vigiar
export const config = {
  matcher: ['/', '/dashboard/:path*', '/admin/:path*'],
};
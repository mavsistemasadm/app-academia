import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Link do e-mail (confirmar cadastro, redefinir senha): chega sem sessão e é
  // justamente ele que cria a sessão. Barrar aqui mandaria para /login.
  if (pathname.startsWith('/auth/')) {
    return supabaseResponse
  }

  // Primeira senha do convidado: abre com a sessão recém-criada (não é "já
  // logado, volta para a home") e também sem sessão — a sessão pode vir no
  // #fragmento, que só o cliente lê, e sem ela a tela explica o link vencido.
  if (pathname.startsWith('/definir-senha')) {
    return supabaseResponse
  }

  // Link de exames que o aluno manda ao médico: quem abre não tem conta. A
  // página valida o token no servidor e só mostra o que ele libera.
  if (pathname.startsWith('/exames/compartilhado/')) {
    return supabaseResponse
  }

  // Rotas de entrada: quem já está logado não deveria estar aqui.
  const publicRoutes = ['/login', '/cadastro', '/esqueci-senha']
  const isPublic = publicRoutes.some(r => pathname.startsWith(r))

  // Não autenticado tentando acessar rota privada
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Autenticado tentando acessar login/cadastro
  if (user && isPublic) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Sem perfil (trigger falhou no cadastro) não dá para escolher destino:
    // mandar para /home faria o layout devolver para cá, em loop infinito.
    if (!profile) {
      return supabaseResponse
    }

    const destino = profile.role === 'professor' ? '/dashboard' : '/home'
    return NextResponse.redirect(new URL(destino, request.url))
  }

  // Aluno tentando acessar área do professor. Os layouts de `(professor)`
  // também barram, mas aqui a resposta sai antes de renderizar qualquer coisa.
  const rotasDoProfessor = [
    '/dashboard',
    '/alunos',
    '/treinos',
    '/agenda-professor',
    '/presenca',
  ]

  if (user && rotasDoProfessor.some((r) => pathname.startsWith(r))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'professor') {
      return NextResponse.redirect(new URL('/home', request.url))
    }
  }

  return supabaseResponse
}

/*
  Fora do middleware de propósito:

  - `api/`      cada rota decide sozinha. O cron manda `Authorization`, não
                cookie de sessão — redirecionar para /login o mataria em
                silêncio, e uma API deve responder 401 em JSON, não 307.
  - `sw.js` e `manifest.webmanifest`  o navegador busca os dois sem sessão
                garantida; um 307 aqui impede a instalação do PWA.
  - `offline`   é justamente a página de quem não tem rede nem sessão.
  - `icones/`   estáticos.
*/
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|offline|icones|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

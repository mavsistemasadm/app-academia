/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  // Conta de aluno só nasce do convite da academia: o cadastro aberto saiu.
  // Link antigo para /cadastro cai no login, que leva ao WhatsApp.
  async redirects() {
    return [{ source: '/cadastro', destination: '/login', permanent: false }]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
}

module.exports = nextConfig
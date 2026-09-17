# E-mail de convite de aluno — configuração no Supabase

O professor convida em **Alunos → Convidar aluno**. O e-mail sai pelo próprio
Supabase; o link leva para `/auth/confirmar` e de lá para `/definir-senha`,
onde o aluno cria a senha e entra na home.

São três ajustes no painel do Supabase (projeto da Atitude Vital).

---

## 1. URLs de redirecionamento

**Authentication → URL Configuration**

- **Site URL:** `https://app-academia-eta.vercel.app`
- **Redirect URLs** — adicione as duas (o `**` aceita a query `?proximo=…`):

```
http://localhost:3005/**
https://app-academia-eta.vercel.app/**
```

Sem isso o Supabase ignora o `redirectTo` do convite e manda o aluno para a
Site URL, fora da tela de criar senha.

## 2. Template "Invite user" em português

**Authentication → Emails → Templates → Invite user**

**Subject:**

```
Seu acesso à Atitude Vital está pronto
```

**Body** (cole em modo HTML):

```html
<div style="margin:0;padding:32px 16px;background:#F3F6F6;font-family:Inter,Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:22px;overflow:hidden;">
    <div style="background:#0F1618;padding:28px 32px;">
      <p style="margin:0;color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:-0.02em;">
        Atitude <span style="color:#00B4CB;">Vital</span>
      </p>
      <p style="margin:6px 0 0;color:rgba(255,255,255,.55);font-size:12px;letter-spacing:.08em;text-transform:uppercase;">
        Central de Saúde Conectada
      </p>
    </div>

    <div style="padding:32px;">
      <h1 style="margin:0 0 12px;color:#0F1618;font-size:22px;line-height:1.25;font-weight:600;">
        Olá{{ if .Data.nome }}, {{ .Data.nome }}{{ end }}! Seu professor te convidou.
      </h1>
      <p style="margin:0 0 24px;color:#5C6466;font-size:15px;line-height:1.6;">
        A partir de agora a Atitude Vital acompanha você entre um treino e outro:
        treino do dia, indicadores, medicamentos e evolução num lugar só.
        Para começar, crie a sua senha.
      </p>

      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;background:#0A8FA3;color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:600;padding:14px 32px;border-radius:999px;">
        Criar minha senha
      </a>

      <p style="margin:28px 0 0;color:#8A9496;font-size:13px;line-height:1.6;">
        O link vale por 24 horas e só pode ser usado uma vez. Se ele expirar,
        peça ao seu professor para reenviar o convite.
      </p>
      <p style="margin:12px 0 0;color:#8A9496;font-size:13px;line-height:1.6;">
        Não esperava este e-mail? Pode ignorar — nada acontece sem você clicar.
      </p>
    </div>
  </div>
</div>
```

> O app aceita os dois formatos de link. Com `{{ .ConfirmationURL }}` a
> sessão chega no `#fragmento` da URL e a própria tela `/definir-senha` a lê.
> Se preferir o formato `token_hash` (resiste melhor a antivírus de e-mail
> corporativo que "clicam" nos links antes da pessoa), troque o `href` por:
>
> `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite`

## 3. Validade do link e envio de e-mail

- **Authentication → Providers → Email → Email OTP Expiration**: 86400
  (24 horas) combina com o texto do e-mail.
- O SMTP padrão do Supabase manda **poucos e-mails por hora** e, em alguns
  planos, só para membros do time. Para convidar a turma inteira, configure um
  SMTP próprio em **Project Settings → Authentication → SMTP Settings**
  (Resend, Brevo, SES…) e ajuste o limite em **Authentication → Rate Limits**.

## Reenvio

"Reenviar" na lista de convites pendentes chama o mesmo convite. Se o
Supabase não aceitar reenviar (e-mail já confirmado, mas a pessoa nunca
entrou), o app manda o e-mail de **Reset password** apontando para a mesma
tela de criar senha — vale traduzir esse template também.

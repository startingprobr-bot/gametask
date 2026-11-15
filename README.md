# GameTask

Tarefas da casa em modo videogame. Node + Express + MySQL, front-end sem build.

## Rodar local (Laragon)
1. Inicie o MySQL do Laragon. 2. `npm install` 3. `.env` já vem de `.env.example` (root sem senha). 4. `npm start` → http://localhost:3000
O banco `gametask` e as tabelas são criados sozinhos. Primeiro acesso: "Criar família" (e-mail, senha e PIN dos pais).
Testes: `npm test` (usa o banco descartável `gametask_test`).

## Deploy no EasyPanel (Hetzner)
1. Crie um serviço **MySQL** no EasyPanel e anote host/usuário/senha/banco.
2. Crie um serviço **App** a partir deste repositório (usa o `Dockerfile`), porta 3000.
3. Variáveis: `DATABASE_URL=mysql://user:senha@host:3306/gametask`, `SESSION_SECRET=<segredo longo>`, `NODE_ENV=production`,
   `OWNER_EMAILS=<seu e-mail de login>` (libera o Painel do dono), `MP_ACCESS_TOKEN=<Access Token de produção do Mercado Pago>`,
   `APP_URL=https://gametask.startingpro.com.br`.
4. Domínio `gametask.startingpro.com.br` com HTTPS no EasyPanel (cookies `secure` exigem HTTPS).
Em cada aparelho: entre com a família uma vez; ele fica conectado. A área dos pais pede o PIN.

## Assinaturas
- `/` mostra a página de vendas para quem não está logado; o app fica em `/app`.
- Família nova ganha o período de teste (padrão 90 dias). Depois disso a API responde 402 e o app mostra os planos.
- Pagamento pelo Mercado Pago Checkout Pro (Pix, cartão, boleto). Cada pagamento aprovado estende o acesso em 1 mês ou 1 ano;
  não há cobrança automática. O webhook `/api/billing/webhook` reconfere o pagamento na API do Mercado Pago.
- Painel do dono (`/app#/dono`, ou botão "Dono" no painel dos pais): faturamento, assinantes, famílias, pagamentos e preços/dias de teste editáveis.

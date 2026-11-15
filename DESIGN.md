# Design — GameTask

Mundo: **lobby de jogo mobile** (régua de acabamento: Brawl Stars, Clash, Nintendo). Claro, saturado, de dia — é usado na sala de casa, não num quarto escuro.

## Tokens (public/css/game.css `:root`)
- **Contorno**: `--navy #0d1b4c`. Todo elemento pressionável tem borda navy de 3px e um "lábio" inferior (`--lip: 0 6px 0 navy`) que afunda no `:active`.
- **Céu do lobby**: `--sky-1 #4aa8ff` → `--sky-2 #2a6cf0` → `--sky-3 #1d3fb8` (gradiente radial vindo do topo), raios giratórios suaves + listras diagonais a 4,5%.
- **Ação**: amarelo `--yellow #ffd21f` (principal/pagar), verde `--green #3bd15f` (concluir/confirmar), vermelho `--red #ff4d5e` (perigo), branco "ghost" (secundário).
- **Recompensas**: azul-ciano = tempo de tela; rosa `--pink` = metas/trilha; ouro = moedas.
- **Cores dos heróis**: `#ff4fae #ff8a1f #3bd15f #8b5bff #19c3c9 #ff4d5e #f5b800`.
- **Painel dos pais**: fundo `--mist #eaf2ff`, caixas brancas com contorno navy, mesmo cabeçalho de céu.

## Tipografia (self-hosted em public/fonts)
- **Lilita One**: títulos, números, botões. Sobre o céu, branco com contorno navy (`.stroke`, `.stroke-sm`).
- **Nunito** (variável, 700–900): todo o texto de leitura. Números em `tabular-nums`.

## Ícones
Microsoft Fluent Emoji 3D (MIT) em `public/img/3d/<slug>.png`. Nunca usar emoji do sistema. O banco guarda o slug (`fox`, `bed`, `game`…); `slug()` em app.js converte emojis antigos. Chrome de UI (voltar, som, apagar) = SVG inline com traço arredondado.

## Componentes
- `.btn` (+ `.green .blue .red .ghost .sm .round`), `.pill` (moeda acoplada no topo), `.hero` (card de seleção com o personagem saindo pela borda), `.mission` (tile de ícone + chips de recompensa + ação), `.segs` (XP do dia, um segmento por missão: cheio/listrado/vazio), `.track` (trilha de troféus da meta), `.panel` (vidro navy sobre o céu), `.sheet` (formulário que sobe de baixo no celular e centraliza no desktop), `.burst` (celebração em tela cheia), `.keypad` (PIN).

## Peso visual
Contornos de 2px, lábio de 4px nos botões (3px nos pequenos), contorno de texto 3,5px nos títulos e 2,5px nos menores. Não engrossar: o responsável achou a versão de 3–4px exagerada.

## Movimento
Mola com overshoot (`--spring`) para entrar e pressionar; `--out` para barras e trilhas. Momento-assinatura: ao tocar "Concluí!", a missão vira "Feito!" e as moedas voam do tile até o contador, que sobe contando. Para a criança, pendente = feito; a aprovação só aparece no painel dos pais (rejeitada vira "Refazer" e o ganho sai). Personagens flutuam devagar. Tudo é desligado com `prefers-reduced-motion`.

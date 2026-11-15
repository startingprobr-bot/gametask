# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Crianças da família** (inicialmente Eva, Ester e Bernardo, com idades bem diferentes — de quem ainda depende de ícones a quem já lê bem). Usam o app num tablet, celular ou computador da casa, já logado na família: escolhem o próprio perfil, veem as missões do dia, marcam "feito" e acompanham moedas, tempo de tela e metas.
- **Pai/mãe (responsável)**: cadastra filhos, tarefas, recompensas e metas; aprova conclusões; paga moedas em dinheiro real; desconta tempo de tela usado.

## Product Purpose
Fazer as crianças cumprirem tarefas da casa e compromissos (jiu-jitsu, natação, igreja) com motivação de jogo. Sucesso: a criança abre o app sozinha, quer completar as missões e entende quanto falta para cada recompensa.

## Positioning
Recompensas que a família já usa de verdade — moedas convertidas em dinheiro, minutos de videogame/YouTube e objetivos como ir ao parque — com divisão automática: o pote de uma recompensa é repartido igualmente entre as tarefas ligadas a ela (20 min ÷ 10 tarefas = 2 min cada).

## Operating Context
- Aparelhos compartilhados da casa, logados uma vez na conta da família (`gametask.startingpro.com.br`).
- Criança marca → fica pendente → responsável aprova → ganhos entram.
- Tempo de tela zera todo dia; moedas acumulam até o responsável pagar.
- Área dos pais protegida por PIN no mesmo aparelho.

## Capabilities and Constraints
- Node + Express + MySQL, front-end HTML/CSS/JS sem build (`public/`). Deploy via Docker no EasyPanel (Hetzner).
- Multi-família; filhos podem ser adicionados a qualquer momento.
- Tarefas diárias (dias da semana) ou esporádicas (data/hora, repetição semanal opcional); cada tarefa pode alimentar várias recompensas.
- Metas por nº de tarefas ou por moedas.

## Brand Commitments
- Nome: **GameTask**.
- O responsável exigiu um visual de **game moderno**, bonito, dinâmico e fluido — nível de acabamento dos jogos que as crianças jogam (Roblox/Minecraft, Brawl Stars/Clash, Nintendo/Mario/Pokémon). O visual retrô pixelado anterior foi rejeitado como arcaico e sem atrativo; nada pode ter "cara de IA".

## Evidence on Hand
Nenhum asset de marca, ilustração ou personagem próprio ainda. Avatares atuais são emojis.

## Product Principles
1. A criança entende a tela sem ler: ícone, cor, número e progresso carregam o sentido; o texto é reforço.
2. Cada ação recebe recompensa sensorial imediata (movimento, som, contagem), mesmo antes da aprovação.
3. Progresso sempre visível: quanto falta para o tempo de tela de hoje e para cada meta.
4. Área dos pais é ferramenta: rápida, clara, aprovações em um toque.

## Accessibility & Inclusion
Idades muito diferentes entre os filhos: alvos de toque grandes, leitura mínima obrigatória na área da criança, respeitar `prefers-reduced-motion`, contraste adequado.

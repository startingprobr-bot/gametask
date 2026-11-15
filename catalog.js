// Catálogo de tarefas e recompensas prontas para o primeiro acesso.
// `on: true` = já vem marcada no assistente. weekdays: 0=dom … 6=sáb.
const ALL = '0123456', WEEK = '12345';

const GROUPS = [
  { key: 'manha', title: 'Manhã', icon: 'sun' },
  { key: 'refeicoes', title: 'Refeições', icon: 'plate' },
  { key: 'higiene', title: 'Dentes e higiene', icon: 'toothbrush' },
  { key: 'casa', title: 'Ajudar em casa', icon: 'house' },
  { key: 'estudos', title: 'Estudos e fé', icon: 'books' },
  { key: 'noite', title: 'Noite', icon: 'moon' },
];

const TASKS = [
  { key: 'dente-acordar', group: 'higiene', title: 'Escovar os dentes ao acordar', icon: 'toothbrush', coins: 0.5, on: true },
  { key: 'cama', group: 'manha', title: 'Arrumar a cama', icon: 'bed', coins: 1, on: true },
  { key: 'vestir', group: 'manha', title: 'Trocar de roupa sozinho', icon: 'shirt', coins: 0.5 },
  { key: 'cafe', group: 'refeicoes', title: 'Tomar café da manhã', icon: 'bowl', coins: 0.5, on: true },
  { key: 'dente-cafe', group: 'higiene', title: 'Escovar os dentes depois do café', icon: 'toothbrush', coins: 0.5, on: true },
  { key: 'almoco', group: 'refeicoes', title: 'Almoçar direitinho', icon: 'plate', coins: 0.5, on: true },
  { key: 'dente-almoco', group: 'higiene', title: 'Escovar os dentes depois do almoço', icon: 'toothbrush', coins: 0.5, on: true },
  { key: 'lanche', group: 'refeicoes', title: 'Lanche da tarde', icon: 'sandwich', coins: 0.5, on: true },
  { key: 'fruta', group: 'refeicoes', title: 'Comer uma fruta', icon: 'apple', coins: 0.5 },
  { key: 'janta', group: 'refeicoes', title: 'Jantar', icon: 'spaghetti', coins: 0.5, on: true },
  { key: 'dente-janta', group: 'higiene', title: 'Escovar os dentes depois da janta', icon: 'toothbrush', coins: 0.5, on: true },
  { key: 'banho', group: 'higiene', title: 'Tomar banho', icon: 'shower', coins: 0.5 },
  { key: 'escrituras', group: 'estudos', title: 'Ler as escrituras', icon: 'openbook', coins: 1, on: true },
  { key: 'oracao', group: 'estudos', title: 'Fazer oração', icon: 'pray', coins: 0.5 },
  { key: 'dever', group: 'estudos', title: 'Fazer o dever de casa', icon: 'pencil', coins: 2, weekdays: WEEK, on: true },
  { key: 'leitura', group: 'estudos', title: 'Ler um livro por 15 minutos', icon: 'books', coins: 1 },
  { key: 'mochila', group: 'estudos', title: 'Arrumar a mochila', icon: 'backpack', coins: 0.5, weekdays: '01234' },
  { key: 'instrumento', group: 'estudos', title: 'Praticar o instrumento', icon: 'music', coins: 1 },
  { key: 'brinquedos', group: 'casa', title: 'Catar os brinquedos', icon: 'teddy', coins: 1, on: true },
  { key: 'louca', group: 'casa', title: 'Lavar a louça', icon: 'soap', coins: 2, on: true },
  { key: 'cesto', group: 'casa', title: 'Guardar as roupas no cesto', icon: 'basket', coins: 1, on: true },
  { key: 'mesa', group: 'casa', title: 'Pôr e tirar a mesa', icon: 'plate', coins: 1 },
  { key: 'lixo', group: 'casa', title: 'Levar o lixo', icon: 'trash', coins: 1 },
  { key: 'varrer', group: 'casa', title: 'Varrer o chão', icon: 'broom', coins: 1.5 },
  { key: 'pet', group: 'casa', title: 'Dar comida ao pet', icon: 'paw', coins: 1 },
  { key: 'plantas', group: 'casa', title: 'Regar as plantas', icon: 'plant', coins: 0.5 },
  { key: 'meias', group: 'casa', title: 'Guardar as roupas limpas', icon: 'socks', coins: 1 },
  { key: 'quarto', group: 'noite', title: 'Deixar o quarto arrumado', icon: 'house', coins: 1 },
  { key: 'dormir', group: 'noite', title: 'Ir para a cama na hora', icon: 'moon', coins: 1 },
];

// Recompensas sugeridas. Tempo: o total do dia é dividido entre as tarefas escolhidas.
const REWARDS = [
  { key: 'videogame', title: 'Videogame', icon: 'game', kind: 'time', value: 30, on: true },
  { key: 'youtube', title: 'YouTube', icon: 'tv', kind: 'time', value: 30, on: true },
  { key: 'passeio', title: 'Passeio especial', icon: 'ferris', kind: 'goal', goal_mode: 'tasks', value: 150, on: true },
  { key: 'sorvete', title: 'Sorvete', icon: 'icecream', kind: 'goal', goal_mode: 'coins', value: 20 },
];

const byKey = Object.fromEntries(TASKS.map(t => [t.key, t]));
module.exports = { GROUPS, TASKS, REWARDS, byKey, ALL };

/**
 * Fonte única de verdade: temas, equipes, DDL fixo e consulta de exibição.
 * Usado pelo app do torneio e pelo site dos alunos. Não editar em outro lugar.
 */

export interface Tema {
  /** identificador curto, também usado como nome do schema Postgres e prompt do console (ex.: "filme=#") */
  id: string;
  nome: string;
  equipeDona: string;
  /** tabela "pai" (lado 1 do 1:N) */
  tabelaPai: string;
  /** tamanho do VARCHAR da coluna "nome" da tabela pai */
  tamanhoPai: number;
  /** tabela "filha" (lado N, guarda os itens em disputa) */
  tabelaFilha: string;
  /** coluna da tabela filha que guarda o nome do item */
  colunaItem: string;
  exemploPai: string;
  exemploItem: string;
}

/** Ordem oficial das 8 equipes (usada também para distribuir INSERTs múltiplos, seção 4.1). */
export const EQUIPES = [
  "Os Astros",
  "Os Chiclettes de Onça",
  "Oreia",
  "Ctrl Alt Del",
  "Sem Limites",
  "South Park",
  "Spider-Man",
  "Marcelita",
] as const;

export type NomeEquipe = (typeof EQUIPES)[number];

/** Emoji de cada equipe, só para identificação visual (não substitui o nome). */
export const EMOJI_EQUIPE: Record<NomeEquipe, string> = {
  "Os Astros": "⭐",
  "Os Chiclettes de Onça": "🙈",
  Oreia: "👂",
  "Ctrl Alt Del": "🙄",
  "Sem Limites": "😅",
  "South Park": "😎",
  "Spider-Man": "🕷️",
  Marcelita: "👾",
};

/** Nome da equipe com o emoji na frente, ex.: "⭐ Os Astros". */
export function rotuloEquipe(equipe: NomeEquipe): string {
  return `${EMOJI_EQUIPE[equipe]} ${equipe}`;
}

export const TEMAS: Tema[] = [
  {
    id: "banda",
    nome: "Banda",
    equipeDona: "Os Astros",
    tabelaPai: "pais",
    tamanhoPai: 50,
    tabelaFilha: "banda",
    colunaItem: "nome",
    exemploPai: "Brasil",
    exemploItem: "Legião Urbana",
  },
  {
    id: "anime",
    nome: "Anime",
    equipeDona: "Os Chiclettes de Onça",
    tabelaPai: "estudio",
    tamanhoPai: 100,
    tabelaFilha: "anime",
    colunaItem: "titulo",
    exemploPai: "MAPPA",
    exemploItem: "Jujutsu Kaisen",
  },
  {
    id: "futebol",
    nome: "Futebol",
    equipeDona: "Oreia",
    tabelaPai: "pais",
    tamanhoPai: 50,
    tabelaFilha: "time",
    colunaItem: "nome",
    exemploPai: "Brasil",
    exemploItem: "Flamengo",
  },
  {
    id: "comida",
    nome: "Comida",
    equipeDona: "Ctrl Alt Del",
    tabelaPai: "categoria",
    tamanhoPai: 50,
    tabelaFilha: "comida",
    colunaItem: "nome",
    exemploPai: "Salgado",
    exemploItem: "Pizza",
  },
  {
    id: "livros",
    nome: "Livros",
    equipeDona: "Sem Limites",
    tabelaPai: "autor",
    tamanhoPai: 100,
    tabelaFilha: "livro",
    colunaItem: "titulo",
    exemploPai: "J. K. Rowling",
    exemploItem: "Harry Potter e a Pedra Filosofal",
  },
  {
    id: "filme",
    nome: "Filme",
    equipeDona: "South Park",
    tabelaPai: "diretor",
    tamanhoPai: 100,
    tabelaFilha: "filme",
    colunaItem: "titulo",
    exemploPai: "Christopher Nolan",
    exemploItem: "Interestelar",
  },
  {
    id: "musica",
    nome: "Música",
    equipeDona: "Spider-Man",
    tabelaPai: "artista",
    tamanhoPai: 100,
    tabelaFilha: "musica",
    colunaItem: "titulo",
    exemploPai: "Queen",
    exemploItem: "Bohemian Rhapsody",
  },
  {
    id: "serie",
    nome: "Série",
    equipeDona: "Marcelita",
    tabelaPai: "plataforma",
    tamanhoPai: 50,
    tabelaFilha: "serie",
    colunaItem: "titulo",
    exemploPai: "Netflix",
    exemploItem: "Stranger Things",
  },
];

export function temaPorId(id: string): Tema | undefined {
  return TEMAS.find((t) => t.id === id);
}

/** DDL fixo do tema (exatamente o que os alunos recebem impresso). */
export function ddlTema(tema: Tema): string {
  return `CREATE TABLE ${tema.tabelaPai} (
    id_${tema.tabelaPai} SERIAL PRIMARY KEY,
    nome VARCHAR(${tema.tamanhoPai}) NOT NULL
);

CREATE TABLE ${tema.tabelaFilha} (
    id_${tema.tabelaFilha} SERIAL PRIMARY KEY,
    ${tema.colunaItem} VARCHAR(100) NOT NULL,
    id_${tema.tabelaPai} INTEGER NOT NULL REFERENCES ${tema.tabelaPai}(id_${tema.tabelaPai})
);`;
}

/** Consulta de exibição do item ("o JOIN do torneio"). */
export function consultaExibicaoTema(tema: Tema): string {
  return `SELECT f.id_${tema.tabelaFilha} AS id, f.${tema.colunaItem} AS item, p.nome AS relacionado
FROM ${tema.tabelaFilha} f JOIN ${tema.tabelaPai} p ON f.id_${tema.tabelaPai} = p.id_${tema.tabelaPai};`;
}

/** INSERT de exemplo (pai + filha), usado no teste automatizado da seção 8. */
export function insertsExemploTema(tema: Tema): string {
  return `INSERT INTO ${tema.tabelaPai} (nome) VALUES ('${tema.exemploPai.replace(/'/g, "''")}');
INSERT INTO ${tema.tabelaFilha} (${tema.colunaItem}, id_${tema.tabelaPai}) VALUES ('${tema.exemploItem.replace(/'/g, "''")}', 1);`;
}

/** Como o item aparece na tela: "item (relacionado)". */
export function rotuloItem(item: string, relacionado: string): string {
  return `${item} (${relacionado})`;
}

/** Nome do schema Postgres usado para isolar o tema dentro do mesmo banco PGlite do app do torneio. */
export function schemaTema(tema: Tema): string {
  return tema.id;
}

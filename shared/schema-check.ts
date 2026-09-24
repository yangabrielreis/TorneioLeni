/**
 * Verifica o script SQL de um aluno contra o schema esperado do tema, via
 * information_schema. As mensagens nunca revelam os nomes esperados de
 * tabelas/colunas (o enunciado é só impresso, de propósito).
 */
import { dividirEmComandos, removerComentariosSql } from "./sql-split";
import type { Tema } from "./themes";

export interface CampoResultado {
  name: string;
  dataTypeID: number;
}

export interface ResultadoQuery {
  command: string;
  rows: Record<string, unknown>[];
  fields: CampoResultado[];
}

/** Interface mínima de um cliente PGlite, para não acoplar este módulo ao pacote inteiro. */
export interface ClienteSql {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; fields: CampoResultado[]; command?: string }>;
}

export interface ItemChecklist {
  chave: "tabelas" | "fk" | "linhas" | "selectComJoin";
  rotulo: string;
  ok: boolean;
}

export interface ResultadoVerificacao {
  ok: boolean;
  checklist: ItemChecklist[];
  /** mensagens genéricas de ajuda para os itens que falharam (sem revelar nomes esperados) */
  mensagens: string[];
  ultimoSelect?: { fields: CampoResultado[]; rows: Record<string, unknown>[] };
  /** primeiro erro do Postgres encontrado ao rodar o script do aluno, se houver */
  erro?: { message: string; detail?: string };
}

function colunaEhTexto(dataType: string): boolean {
  return dataType === "character varying" || dataType === "text";
}

function colunaEhInteiro(dataType: string): boolean {
  return dataType === "integer" || dataType === "bigint" || dataType === "smallint";
}

async function tabelaExisteComColunas(
  db: ClienteSql,
  tabela: string,
  colunasEsperadas: { nome: string; tipo: "texto" | "inteiro" }[],
): Promise<boolean> {
  const r = await db.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1;`,
    [tabela],
  );
  if (r.rows.length === 0) return false;
  const porNome = new Map(r.rows.map((c) => [c.column_name, c.data_type]));
  return colunasEsperadas.every(({ nome, tipo }) => {
    const dataType = porNome.get(nome);
    if (!dataType) return false;
    return tipo === "texto" ? colunaEhTexto(dataType) : colunaEhInteiro(dataType);
  });
}

async function fkExisteEntre(db: ClienteSql, tabelaOrigem: string, tabelaDestino: string): Promise<boolean> {
  const r = await db.query<{ tabela_origem: string; tabela_destino: string }>(
    `SELECT tc.table_name AS tabela_origem, ccu.table_name AS tabela_destino
     FROM information_schema.table_constraints tc
     JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';`,
  );
  return r.rows.some((row) => row.tabela_origem === tabelaOrigem && row.tabela_destino === tabelaDestino);
}

async function contarLinhas(db: ClienteSql, tabela: string): Promise<number> {
  try {
    const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${tabela};`);
    return Number(r.rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

function temSelectComJoin(script: string): boolean {
  const { completos } = dividirEmComandos(script);
  return completos.some((c) => {
    const semComentarios = removerComentariosSql(c).trim();
    return /^select\b/i.test(semComentarios) && /\bjoin\b/i.test(semComentarios);
  });
}

export async function verificarScriptAluno(db: ClienteSql, tema: Tema, script: string): Promise<ResultadoVerificacao> {
  const { completos } = dividirEmComandos(script);

  let ultimoSelect: ResultadoVerificacao["ultimoSelect"];
  let erro: ResultadoVerificacao["erro"];

  for (const comando of completos) {
    try {
      const resultado = await db.query(comando);
      if (resultado.command === "SELECT") {
        ultimoSelect = { fields: resultado.fields, rows: resultado.rows };
      }
    } catch (e) {
      const err = e as { message: string; detail?: string };
      if (!erro) erro = { message: err.message, detail: err.detail };
    }
  }

  const tabelaPaiOk = await tabelaExisteComColunas(db, tema.tabelaPai, [
    { nome: `id_${tema.tabelaPai}`, tipo: "inteiro" },
    { nome: "nome", tipo: "texto" },
  ]);
  const tabelaFilhaOk = await tabelaExisteComColunas(db, tema.tabelaFilha, [
    { nome: `id_${tema.tabelaFilha}`, tipo: "inteiro" },
    { nome: tema.colunaItem, tipo: "texto" },
    { nome: `id_${tema.tabelaPai}`, tipo: "inteiro" },
  ]);
  const tabelasOk = tabelaPaiOk && tabelaFilhaOk;

  const fkOk = tabelasOk && (await fkExisteEntre(db, tema.tabelaFilha, tema.tabelaPai));

  const linhasPai = tabelaPaiOk ? await contarLinhas(db, tema.tabelaPai) : 0;
  const linhasFilha = tabelaFilhaOk ? await contarLinhas(db, tema.tabelaFilha) : 0;
  const linhasOk = linhasPai >= 1 && linhasFilha >= 1;

  const joinOk = temSelectComJoin(script);

  const checklist: ItemChecklist[] = [
    { chave: "tabelas", rotulo: "As duas tabelas exigidas existem, com as colunas certas", ok: tabelasOk },
    { chave: "fk", rotulo: "A chave estrangeira entre as tabelas existe", ok: fkOk },
    { chave: "linhas", rotulo: "Cada tabela tem pelo menos 1 linha", ok: linhasOk },
    { chave: "selectComJoin", rotulo: "Existe um SELECT com JOIN no script", ok: joinOk },
  ];

  const mensagens: string[] = [];
  if (!tabelasOk) mensagens.push("Falta uma tabela ou coluna exigida no enunciado. Confira os nomes no papel.");
  if (tabelasOk && !fkOk) mensagens.push("A ligação (chave estrangeira) entre as duas tabelas não foi encontrada.");
  if (!linhasOk) mensagens.push("Ainda falta inserir uma linha em alguma das tabelas.");
  if (!joinOk) mensagens.push("Não foi encontrado um SELECT com JOIN no script.");

  return {
    ok: checklist.every((i) => i.ok),
    checklist,
    mensagens,
    ultimoSelect,
    erro,
  };
}

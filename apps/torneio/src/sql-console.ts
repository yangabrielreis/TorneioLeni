/**
 * Motor do console estilo psql: separação de comandos, bloqueio de DDL,
 * formatação de resultado em tabela ASCII e de erros. Sem DOM (fácil de testar).
 */
import { removerComentariosSql } from "../../../shared/sql-split";

export interface CampoResultado {
  name: string;
  dataTypeID: number;
}

export interface ResultadoQuery {
  command: string;
  rowCount: number;
  affectedRows: number;
  rows: Record<string, unknown>[];
  fields: CampoResultado[];
}

export interface ErroPostgres {
  message: string;
  detail?: string;
}

const PALAVRAS_DDL_BLOQUEADAS = /^\s*(create|drop|alter|truncate)\b/i;

/** true se o comando (já terminado em ";") é um DDL que o console deve recusar. */
export function comandoBloqueadoDDL(comando: string): boolean {
  return PALAVRAS_DDL_BLOQUEADAS.test(removerComentariosSql(comando));
}

export { dividirEmComandos, removerComentariosSql } from "../../../shared/sql-split";

const OIDS_NUMERICOS = new Set([20, 21, 23, 700, 701, 1700]);

function formatarValor(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function centralizar(texto: string, largura: number): string {
  const falta = Math.max(0, largura - texto.length);
  const esquerda = Math.floor(falta / 2);
  const direita = falta - esquerda;
  return " ".repeat(esquerda) + texto + " ".repeat(direita);
}

/** Tabela ASCII no estilo psql, incluindo o rodapé "(N rows)". */
export function formatarTabelaPsql(fields: CampoResultado[], rows: Record<string, unknown>[]): string {
  const colunas = fields.map((f) => f.name);
  const celulas = rows.map((row) => colunas.map((c) => formatarValor(row[c])));
  const larguras = colunas.map((nome, i) =>
    Math.max(nome.length, ...celulas.map((linha) => linha[i].length), 0),
  );
  const numericas = fields.map((f) => OIDS_NUMERICOS.has(f.dataTypeID));

  const cabecalho = colunas.map((nome, i) => centralizar(nome, larguras[i])).join(" | ");
  const separador = larguras.map((w) => "-".repeat(w + 2)).join("+");
  const linhas = celulas.map((linha) =>
    linha.map((valor, i) => (numericas[i] ? valor.padStart(larguras[i]) : valor.padEnd(larguras[i]))).join(" | "),
  );

  const corpo = [` ${cabecalho} `, separador, ...linhas.map((l) => ` ${l} `)];
  const rodape = `(${rows.length} ${rows.length === 1 ? "row" : "rows"})`;
  return [...corpo, rodape].join("\n");
}

/** Formata a resposta de um comando, no estilo psql ("INSERT 0 1", tabela para SELECT etc.). */
export function formatarResultado(resultado: ResultadoQuery): string {
  switch (resultado.command) {
    case "SELECT":
    case "SHOW":
      return formatarTabelaPsql(resultado.fields, resultado.rows);
    case "INSERT":
      return `INSERT 0 ${resultado.affectedRows}`;
    case "UPDATE":
      return `UPDATE ${resultado.affectedRows}`;
    case "DELETE":
      return `DELETE ${resultado.affectedRows}`;
    default:
      return resultado.command;
  }
}

export function formatarErro(erro: ErroPostgres): string {
  const linhas = [`ERROR:  ${erro.message}`];
  if (erro.detail) linhas.push(`DETAIL:  ${erro.detail}`);
  return linhas.join("\n");
}

export const AJUDA_META_COMANDOS = `Comandos disponíveis:
  \\dt           lista as tabelas do tema atual
  \\d <tabela>   descreve as colunas de uma tabela
  \\?            mostra esta ajuda
  clear          limpa a tela do console`;

export function sqlListarTabelas(schema: string): { sql: string; params: unknown[] } {
  return {
    sql: `SELECT table_name AS "Tabela" FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name;`,
    params: [schema],
  };
}

export function sqlDescreverTabela(schema: string, tabela: string): { sql: string; params: unknown[] } {
  return {
    sql: `SELECT column_name AS "Coluna", data_type AS "Tipo", is_nullable AS "Aceita nulo" FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position;`,
    params: [schema, tabela],
  };
}

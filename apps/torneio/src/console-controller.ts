import type { PGlite } from "@electric-sql/pglite";
import { EQUIPES, type NomeEquipe, type Tema } from "../../../shared/themes";
import {
  AJUDA_META_COMANDOS,
  comandoBloqueadoDDL,
  dividirEmComandos,
  formatarErro,
  formatarResultado,
  formatarTabelaPsql,
  sqlDescreverTabela,
  sqlListarTabelas,
  type ResultadoQuery,
} from "./sql-console";
import { definirEsquemaAtivo } from "./db";

export interface LinhaSaida {
  tipo: "comando" | "resultado" | "erro" | "info";
  texto: string;
}

/** Uma nova linha inserida na tabela filha do tema, ainda sem equipe atribuída pelo chamador. */
export interface NovaLinhaFilha {
  idFilha: number;
  item: string;
}

export interface ResultadoExecucao {
  linhas: LinhaSaida[];
  novasLinhasFilha: NovaLinhaFilha[];
  limpar?: boolean;
}

function nomeTabelaAlvo(comando: string): string | null {
  const m = comando.match(/^\s*insert\s+into\s+(?:"?\w+"?\.)?"?(\w+)"?/i);
  return m ? m[1].toLowerCase() : null;
}

function temReturning(comando: string): boolean {
  return /\breturning\b/i.test(comando);
}

interface SaidaComando {
  linha: LinhaSaida;
  novasLinhasFilha: NovaLinhaFilha[];
}

/** Executa um comando já completo (terminado em ';') contra o schema do tema. */
async function executarComando(db: PGlite, tema: Tema, comando: string): Promise<SaidaComando> {
  if (comandoBloqueadoDDL(comando)) {
    return { linha: { tipo: "erro", texto: "ERROR:  o schema é fixo neste console" }, novasLinhasFilha: [] };
  }

  await definirEsquemaAtivo(db, tema);

  const alvo = nomeTabelaAlvo(comando);
  const ehInsertNaFilha = alvo === tema.tabelaFilha.toLowerCase();
  const originalTinhaReturning = temReturning(comando);
  const comandoParaExecutar =
    ehInsertNaFilha && !originalTinhaReturning
      ? comando.replace(/;\s*$/, ` RETURNING id_${tema.tabelaFilha} AS id_gerado, ${tema.colunaItem} AS item_gerado;`)
      : comando;

  try {
    const resultado = (await db.query(comandoParaExecutar)) as ResultadoQuery;
    const novasLinhasFilha: NovaLinhaFilha[] =
      ehInsertNaFilha && !originalTinhaReturning
        ? resultado.rows.map((r) => ({ idFilha: Number(r.id_gerado), item: String(r.item_gerado) }))
        : [];

    const mostrarComoTabela = resultado.command === "SELECT" || originalTinhaReturning;
    const texto = mostrarComoTabela ? formatarTabelaPsql(resultado.fields, resultado.rows) : formatarResultado(resultado);

    return { linha: { tipo: "resultado", texto }, novasLinhasFilha };
  } catch (erro) {
    return {
      linha: { tipo: "erro", texto: formatarErro(erro as { message: string; detail?: string }) },
      novasLinhasFilha: [],
    };
  }
}

/** Meta-comandos: \dt, \d <tabela>, \?, clear. Retorna null se `entrada` não for um meta-comando. */
async function executarMetaComando(db: PGlite, tema: Tema, entrada: string): Promise<ResultadoExecucao | null> {
  const linha = entrada.trim();
  if (linha === "") return { linhas: [], novasLinhasFilha: [] };
  if (linha === "clear") return { linhas: [], novasLinhasFilha: [], limpar: true };
  if (linha === "\\?") return { linhas: [{ tipo: "info", texto: AJUDA_META_COMANDOS }], novasLinhasFilha: [] };

  if (linha === "\\dt") {
    await definirEsquemaAtivo(db, tema);
    const { sql, params } = sqlListarTabelas(tema.id);
    const r = (await db.query(sql, params)) as ResultadoQuery;
    return { linhas: [{ tipo: "resultado", texto: formatarTabelaPsql(r.fields, r.rows) }], novasLinhasFilha: [] };
  }

  const matchD = linha.match(/^\\d\s+(\w+)\s*$/);
  if (matchD) {
    await definirEsquemaAtivo(db, tema);
    const { sql, params } = sqlDescreverTabela(tema.id, matchD[1].toLowerCase());
    const r = (await db.query(sql, params)) as ResultadoQuery;
    if (r.rows.length === 0) {
      return { linhas: [{ tipo: "erro", texto: `ERROR:  relation "${matchD[1]}" does not exist` }], novasLinhasFilha: [] };
    }
    return { linhas: [{ tipo: "resultado", texto: formatarTabelaPsql(r.fields, r.rows) }], novasLinhasFilha: [] };
  }

  return null;
}

/**
 * Processa uma linha digitada pelo usuário, dado o buffer de continuação acumulado.
 * Meta-comandos só são reconhecidos quando não há continuação em aberto.
 */
export async function processarEntrada(params: {
  db: PGlite;
  tema: Tema;
  bufferAtual: string;
  entrada: string;
}): Promise<ResultadoExecucao & { restoBuffer: string }> {
  const { db, tema, bufferAtual, entrada } = params;

  if (bufferAtual === "") {
    const meta = await executarMetaComando(db, tema, entrada);
    if (meta) return { ...meta, restoBuffer: "" };
  }

  const buffer = bufferAtual === "" ? entrada : `${bufferAtual}\n${entrada}`;
  const { completos, resto } = dividirEmComandos(buffer);

  const linhas: LinhaSaida[] = [];
  const novasLinhasFilha: NovaLinhaFilha[] = [];
  for (const comando of completos) {
    const saida = await executarComando(db, tema, comando);
    linhas.push(saida.linha);
    novasLinhasFilha.push(...saida.novasLinhasFilha);
  }
  return { linhas, novasLinhasFilha, restoBuffer: resto };
}

export interface ResultadoCadastroRapido {
  linhas: LinhaSaida[];
  idFilha: number;
}

/**
 * Cadastro rápido: monta e executa os dois INSERTs (pai e filha) a partir só
 * dos valores que mudam, e imprime no console exatamente como se tivessem
 * sido digitados — pra manter a "cara de psql" mesmo usando o formulário.
 *
 * Se já existir um "pai" com o mesmo nome neste tema (ex.: duas bandas do
 * mesmo país, dois filmes do mesmo diretor), reaproveita a linha existente
 * em vez de duplicar — a comparação ignora maiúsculas/minúsculas e espaços
 * nas pontas.
 */
export async function cadastrarItemRapido(params: {
  db: PGlite;
  tema: Tema;
  relacionado: string;
  item: string;
}): Promise<ResultadoCadastroRapido> {
  const { db, tema, relacionado, item } = params;
  await definirEsquemaAtivo(db, tema);

  const linhas: LinhaSaida[] = [];
  const escapar = (v: string) => v.replace(/'/g, "''");

  const existente = await db.query<{ id: number }>(
    `SELECT id_${tema.tabelaPai} AS id FROM ${tema.tabelaPai} WHERE lower(trim(nome)) = lower(trim($1)) LIMIT 1;`,
    [relacionado],
  );

  let idPai: number;
  if (existente.rows.length > 0) {
    idPai = existente.rows[0].id;
    linhas.push({
      tipo: "info",
      texto: `-- "${relacionado}" já existe em ${tema.tabelaPai} (id ${idPai}); reaproveitando essa linha em vez de duplicar.`,
    });
  } else {
    const comandoPai = `INSERT INTO ${tema.tabelaPai} (nome) VALUES ('${escapar(relacionado)}');`;
    linhas.push({ tipo: "comando", texto: `${tema.id}=# ${comandoPai}` });
    const resPai = await db.query<{ id: number }>(
      `INSERT INTO ${tema.tabelaPai} (nome) VALUES ($1) RETURNING id_${tema.tabelaPai} AS id;`,
      [relacionado],
    );
    linhas.push({ tipo: "resultado", texto: "INSERT 0 1" });
    idPai = resPai.rows[0].id;
  }

  const comandoFilha = `INSERT INTO ${tema.tabelaFilha} (${tema.colunaItem}, id_${tema.tabelaPai}) VALUES ('${escapar(item)}', ${idPai});`;
  linhas.push({ tipo: "comando", texto: `${tema.id}=# ${comandoFilha}` });
  const resFilha = await db.query<{ id: number }>(
    `INSERT INTO ${tema.tabelaFilha} (${tema.colunaItem}, id_${tema.tabelaPai}) VALUES ($1, $2) RETURNING id_${tema.tabelaFilha} AS id;`,
    [item, idPai],
  );
  linhas.push({ tipo: "resultado", texto: "INSERT 0 1" });

  return { linhas, idFilha: resFilha.rows[0].id };
}

/** Distribui várias linhas novas da filha entre equipes ainda sem item, na ordem oficial da seção 3. */
export function distribuirNovasLinhas(
  novas: NovaLinhaFilha[],
  equipesJaAtribuidas: Set<NomeEquipe>,
): { idFilha: number; item: string; equipe: NomeEquipe }[] {
  const livres = EQUIPES.filter((e) => !equipesJaAtribuidas.has(e));
  return novas.slice(0, livres.length).map((linha, i) => ({ ...linha, equipe: livres[i] }));
}

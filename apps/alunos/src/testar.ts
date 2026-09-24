import { verificarScriptAluno, type ResultadoVerificacao } from "../../../shared/schema-check";
import type { Tema } from "../../../shared/themes";

/** true assim que sabemos que o PGlite não conseguiu ser carregado (ex.: rede bloqueada). */
let pgliteIndisponivel = false;

export function pgliteEstaIndisponivel(): boolean {
  return pgliteIndisponivel;
}

export async function testarScript(tema: Tema, sql: string): Promise<ResultadoVerificacao> {
  const { PGlite } = await import("@electric-sql/pglite").catch((e) => {
    pgliteIndisponivel = true;
    throw e;
  });
  const db = new PGlite();
  try {
    return await verificarScriptAluno(db, tema, sql);
  } finally {
    await db.close();
  }
}

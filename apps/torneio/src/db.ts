import { PGlite } from "@electric-sql/pglite";
import { TEMAS, ddlTema, schemaTema, type Tema } from "../../../shared/themes";

let instancia: PGlite | null = null;
let pronto: Promise<PGlite> | null = null;

/** Instância única do PGlite do app, persistida em IndexedDB (idb://). Cria o schema de cada tema. */
export function obterBanco(): Promise<PGlite> {
  if (!pronto) pronto = inicializar();
  return pronto;
}

async function inicializar(): Promise<PGlite> {
  const db = new PGlite("idb://torneio-bd");
  for (const tema of TEMAS) {
    const schema = schemaTema(tema);
    const ddlIdempotente = ddlTema(tema).replace(/CREATE TABLE /g, "CREATE TABLE IF NOT EXISTS ");
    await db.exec(`CREATE SCHEMA IF NOT EXISTS "${schema}";`);
    await db.exec(`SET search_path TO "${schema}";\n${ddlIdempotente}`);
  }
  await db.query(`SET search_path TO public;`);
  instancia = db;
  return db;
}

export async function definirEsquemaAtivo(db: PGlite, tema: Tema): Promise<void> {
  await db.query(`SET search_path TO "${schemaTema(tema)}";`);
}

/** Apaga todos os dados das tabelas (mantém o schema) e recria vazio. Usado em "Reiniciar tudo". */
export async function apagarBanco(): Promise<void> {
  const db = await obterBanco();
  for (const tema of TEMAS) {
    const schema = schemaTema(tema);
    await db.exec(`DROP SCHEMA IF EXISTS "${schema}" CASCADE;`);
  }
  for (const tema of TEMAS) {
    const schema = schemaTema(tema);
    const ddlIdempotente = ddlTema(tema).replace(/CREATE TABLE /g, "CREATE TABLE IF NOT EXISTS ");
    await db.exec(`CREATE SCHEMA IF NOT EXISTS "${schema}";`);
    await db.exec(`SET search_path TO "${schema}";\n${ddlIdempotente}`);
  }
  await db.query(`SET search_path TO public;`);
}

export function bancoAtual(): PGlite | null {
  return instancia;
}

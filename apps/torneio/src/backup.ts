import { TEMAS, schemaTema } from "../../../shared/themes";
import { apagarBanco, obterBanco } from "./db";
import { salvarEstado, type EstadoTorneio } from "./state";
import { limparTodasImagens } from "./imagens";

export interface BackupJSON {
  versao: 1;
  criadoEm: string;
  estado: EstadoTorneio;
  tabelas: Record<string, { pai: Record<string, unknown>[]; filha: Record<string, unknown>[] }>;
}

export async function exportarBackup(estado: EstadoTorneio): Promise<BackupJSON> {
  const db = await obterBanco();
  const tabelas: BackupJSON["tabelas"] = {};
  for (const tema of TEMAS) {
    const schema = schemaTema(tema);
    const pai = await db.query(`SELECT * FROM "${schema}".${tema.tabelaPai} ORDER BY 1;`);
    const filha = await db.query(`SELECT * FROM "${schema}".${tema.tabelaFilha} ORDER BY 1;`);
    tabelas[tema.id] = { pai: pai.rows as Record<string, unknown>[], filha: filha.rows as Record<string, unknown>[] };
  }
  return { versao: 1, criadoEm: new Date().toISOString(), estado, tabelas };
}

async function reinserirLinhas(
  db: Awaited<ReturnType<typeof obterBanco>>,
  schema: string,
  tabela: string,
  colunaId: string,
  linhas: Record<string, unknown>[],
): Promise<void> {
  for (const linha of linhas) {
    const colunas = Object.keys(linha);
    const valores = colunas.map((c) => linha[c]);
    const placeholders = colunas.map((_, i) => `$${i + 1}`).join(", ");
    await db.query(`INSERT INTO "${schema}".${tabela} (${colunas.join(", ")}) VALUES (${placeholders});`, valores);
  }
  await db.query(
    `SELECT setval(pg_get_serial_sequence('"${schema}".${tabela}', '${colunaId}'), COALESCE((SELECT MAX(${colunaId}) FROM "${schema}".${tabela}), 1), (SELECT COUNT(*) FROM "${schema}".${tabela}) > 0);`,
  );
}

/**
 * Restaura um backup. As imagens coladas (Ctrl+V) não fazem parte do arquivo
 * de backup, então são descartadas aqui: manter as imagens antigas seria
 * arriscado, já que os ids do banco importado podem não corresponder aos
 * itens que essas imagens identificavam antes.
 */
export async function importarBackup(backup: BackupJSON): Promise<EstadoTorneio> {
  await apagarBanco();
  limparTodasImagens();
  const db = await obterBanco();
  for (const tema of TEMAS) {
    const schema = schemaTema(tema);
    const dados = backup.tabelas[tema.id];
    if (!dados) continue;
    await reinserirLinhas(db, schema, tema.tabelaPai, `id_${tema.tabelaPai}`, dados.pai);
    await reinserirLinhas(db, schema, tema.tabelaFilha, `id_${tema.tabelaFilha}`, dados.filha);
  }
  salvarEstado(backup.estado);
  return backup.estado;
}

export function baixarBackupComoArquivo(backup: BackupJSON): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const carimbo = backup.criadoEm.replace(/[:.]/g, "-");
  a.href = url;
  a.download = `backup-torneio-bd-${carimbo}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

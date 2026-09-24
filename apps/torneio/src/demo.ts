import { EQUIPES, TEMAS, type NomeEquipe } from "../../../shared/themes";
import { definirEsquemaAtivo, obterBanco } from "./db";
import { equipesComItem, type EstadoTorneio } from "./state";

/**
 * Preenche as vagas ainda vazias de todos os temas com dados fictícios
 * (pai "Exemplo N", item "Item N"), para testar o chaveamento sem digitar 64 INSERTs.
 */
export async function preencherModoDemonstracao(
  estado: EstadoTorneio,
): Promise<Record<string, Record<number, NomeEquipe>>> {
  const db = await obterBanco();
  const novasAtribuicoes: Record<string, Record<number, NomeEquipe>> = {};

  for (const tema of TEMAS) {
    await definirEsquemaAtivo(db, tema);
    novasAtribuicoes[tema.id] = { ...estado.atribuicoes[tema.id] };
    const jaAtribuidas = equipesComItem(estado, tema.id);

    let n = 1;
    for (const equipe of EQUIPES) {
      if (jaAtribuidas.has(equipe)) continue;

      const paiRes = await db.query<{ id: number }>(
        `INSERT INTO ${tema.tabelaPai} (nome) VALUES ($1) RETURNING id_${tema.tabelaPai} AS id;`,
        [`Exemplo ${n}`],
      );
      const idPai = paiRes.rows[0].id;

      const filhaRes = await db.query<{ id: number }>(
        `INSERT INTO ${tema.tabelaFilha} (${tema.colunaItem}, id_${tema.tabelaPai}) VALUES ($1, $2) RETURNING id_${tema.tabelaFilha} AS id;`,
        [`Item ${n}`, idPai],
      );
      novasAtribuicoes[tema.id][filhaRes.rows[0].id] = equipe;
      n++;
    }
  }

  return novasAtribuicoes;
}

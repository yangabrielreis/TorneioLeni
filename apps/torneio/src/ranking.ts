import { EQUIPES, type NomeEquipe } from "../../../shared/themes";
import type { Chaveamento } from "./bracket";
import type { EstadoTorneio } from "./state";

export interface LinhaRanking {
  equipe: NomeEquipe;
  votos: number;
}

/**
 * Ranking geral: soma os votos recebidos pelos itens de cada equipe em todos os
 * confrontos (dos 8 temas e da final geral), não só nos que ela venceu.
 */
export function calcularRanking(estado: EstadoTorneio): LinhaRanking[] {
  const totais = new Map<NomeEquipe, number>(EQUIPES.map((e) => [e, 0]));

  const chaveamentos: Chaveamento[] = Object.values(estado.chaveamentos);
  if (estado.finalGeral) chaveamentos.push(estado.finalGeral);

  for (const chaveamento of chaveamentos) {
    for (const confronto of chaveamento.confrontos) {
      if (confronto.a && confronto.votosA) {
        totais.set(confronto.a.equipe as NomeEquipe, (totais.get(confronto.a.equipe as NomeEquipe) ?? 0) + confronto.votosA);
      }
      if (confronto.b && confronto.votosB) {
        totais.set(confronto.b.equipe as NomeEquipe, (totais.get(confronto.b.equipe as NomeEquipe) ?? 0) + confronto.votosB);
      }
    }
  }

  return EQUIPES.map((equipe) => ({ equipe, votos: totais.get(equipe) ?? 0 })).sort((a, b) => b.votos - a.votos);
}

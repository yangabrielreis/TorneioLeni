import { describe, expect, it } from "vitest";
import { EQUIPES } from "../../../shared/themes";
import { sortearChaveamento, incrementarVoto, decidirVencedor, type Participante } from "./bracket";
import { estadoInicial } from "./state";
import { calcularRanking } from "./ranking";

function participantes(temaId: string): Participante[] {
  return EQUIPES.map((equipe) => ({
    chave: equipe,
    item: `Item de ${equipe}`,
    relacionado: `Relacionado ${temaId}`,
    equipe,
  }));
}

describe("ranking geral por votos", () => {
  it("começa zerado para todas as equipes", () => {
    const ranking = calcularRanking(estadoInicial());
    expect(ranking).toHaveLength(8);
    expect(ranking.every((l) => l.votos === 0)).toBe(true);
  });

  it("soma votos de vários confrontos e temas, mesmo sem decisão ainda", () => {
    const estado = estadoInicial();
    const chBanda = sortearChaveamento(participantes("banda"), 1);
    incrementarVoto(chBanda, "q0", "a", 5);
    incrementarVoto(chBanda, "q0", "b", 2);
    estado.chaveamentos["banda"] = chBanda;

    const equipeA = chBanda.confrontos.find((c) => c.id === "q0")!.a!.equipe;
    const equipeB = chBanda.confrontos.find((c) => c.id === "q0")!.b!.equipe;

    const ranking = calcularRanking(estado);
    expect(ranking.find((l) => l.equipe === equipeA)?.votos).toBe(5);
    expect(ranking.find((l) => l.equipe === equipeB)?.votos).toBe(2);
  });

  it("conta também os votos da final geral, e o ranking vem ordenado do maior pro menor", () => {
    const estado = estadoInicial();
    const chFilme = sortearChaveamento(participantes("filme"), 2);
    const q0 = chFilme.confrontos.find((c) => c.id === "q0")!;
    incrementarVoto(chFilme, "q0", "a", 10);
    decidirVencedor(chFilme, "q0", q0.a!.chave);
    estado.chaveamentos["filme"] = chFilme;

    const chFinal = sortearChaveamento(participantes("final"), 3);
    incrementarVoto(chFinal, "q1", "b", 3);
    estado.finalGeral = chFinal;

    const ranking = calcularRanking(estado);
    expect(ranking[0].votos).toBeGreaterThanOrEqual(ranking[1].votos);
    const totalVotos = ranking.reduce((soma, l) => soma + l.votos, 0);
    expect(totalVotos).toBe(13);
  });
});

import { describe, expect, it } from "vitest";
import {
  sortearChaveamento,
  decidirVencedor,
  desfazerUltimaDecisao,
  vencedorPorVotos,
  incrementarVoto,
  chaveamentoCompleto,
  podeSortearNovamente,
  type Participante,
} from "./bracket";

function participantes(): Participante[] {
  return Array.from({ length: 8 }, (_, i) => ({
    chave: `equipe-${i}`,
    item: `Item ${i}`,
    relacionado: `Relacionado ${i}`,
    equipe: `equipe-${i}`,
  }));
}

describe("mata-mata de 8 participantes", () => {
  it("8 itens geram exatamente 7 confrontos (4 quartas + 2 semis + 1 final)", () => {
    const ch = sortearChaveamento(participantes(), 42);
    expect(ch.confrontos).toHaveLength(7);
    expect(ch.confrontos.filter((c) => c.rodada === "quartas")).toHaveLength(4);
    expect(ch.confrontos.filter((c) => c.rodada === "semis")).toHaveLength(2);
    expect(ch.confrontos.filter((c) => c.rodada === "final")).toHaveLength(1);
  });

  it("exige exatamente 8 participantes", () => {
    expect(() => sortearChaveamento(participantes().slice(0, 7), 1)).toThrow();
  });

  it("o vencedor avança para o próximo confronto", () => {
    const ch = sortearChaveamento(participantes(), 7);
    const q0 = ch.confrontos.find((c) => c.id === "q0")!;
    decidirVencedor(ch, "q0", q0.a!.chave);
    const s0 = ch.confrontos.find((c) => c.id === "s0")!;
    expect(s0.a?.chave).toBe(q0.a!.chave);
  });

  it("decide o torneio inteiro até haver campeão", () => {
    const ch = sortearChaveamento(participantes(), 123);
    for (const id of ["q0", "q1", "q2", "q3"]) {
      const c = ch.confrontos.find((x) => x.id === id)!;
      decidirVencedor(ch, id, c.a!.chave);
    }
    for (const id of ["s0", "s1"]) {
      const c = ch.confrontos.find((x) => x.id === id)!;
      decidirVencedor(ch, id, c.a!.chave);
    }
    expect(chaveamentoCompleto(ch)).toBe(false);
    const f0 = ch.confrontos.find((c) => c.id === "f0")!;
    decidirVencedor(ch, "f0", f0.a!.chave);
    expect(chaveamentoCompleto(ch)).toBe(true);
    expect(ch.campeao).toBeDefined();
  });

  it("desfazer reverte a última decisão e limpa o avanço", () => {
    const ch = sortearChaveamento(participantes(), 55);
    const q0 = ch.confrontos.find((c) => c.id === "q0")!;
    decidirVencedor(ch, "q0", q0.a!.chave);
    desfazerUltimaDecisao(ch);
    const q0depois = ch.confrontos.find((c) => c.id === "q0")!;
    const s0depois = ch.confrontos.find((c) => c.id === "s0")!;
    expect(q0depois.vencedor).toBeUndefined();
    expect(s0depois.a).toBeUndefined();
  });

  it("desfazer sem decisões lança erro", () => {
    const ch = sortearChaveamento(participantes(), 1);
    expect(() => desfazerUltimaDecisao(ch)).toThrow();
  });

  it("empate em votos exige escolha manual (vencedorPorVotos retorna undefined)", () => {
    expect(vencedorPorVotos(5, 5)).toBeUndefined();
    expect(vencedorPorVotos(6, 5)).toBe("a");
    expect(vencedorPorVotos(3, 9)).toBe("b");
  });

  it("incrementarVoto soma e tira votos de cada lado, sem passar de zero", () => {
    const ch = sortearChaveamento(participantes(), 3);
    incrementarVoto(ch, "q0", "a", 1);
    incrementarVoto(ch, "q0", "a", 1);
    incrementarVoto(ch, "q0", "b", 1);
    const q0 = ch.confrontos.find((c) => c.id === "q0")!;
    expect(q0.votosA).toBe(2);
    expect(q0.votosB).toBe(1);
    incrementarVoto(ch, "q0", "b", -5);
    expect(ch.confrontos.find((c) => c.id === "q0")!.votosB).toBe(0);
  });

  it("desfazer mantém os votos já contados (só desfaz a decisão do vencedor)", () => {
    const ch = sortearChaveamento(participantes(), 55);
    incrementarVoto(ch, "q0", "a", 3);
    incrementarVoto(ch, "q0", "b", 1);
    const q0 = ch.confrontos.find((c) => c.id === "q0")!;
    decidirVencedor(ch, "q0", q0.a!.chave);
    desfazerUltimaDecisao(ch);
    const q0depois = ch.confrontos.find((c) => c.id === "q0")!;
    expect(q0depois.votosA).toBe(3);
    expect(q0depois.votosB).toBe(1);
  });

  it("não permite votar num confronto que ainda não tem os dois lados ou que já foi decidido", () => {
    const ch = sortearChaveamento(participantes(), 3);
    expect(() => incrementarVoto(ch, "s0", "a", 1)).toThrow();
    const q0 = ch.confrontos.find((c) => c.id === "q0")!;
    decidirVencedor(ch, "q0", q0.a!.chave);
    expect(() => incrementarVoto(ch, "q0", "a", 1)).toThrow();
  });

  it("só permite sortear de novo enquanto nada foi decidido", () => {
    const ch = sortearChaveamento(participantes(), 9);
    expect(podeSortearNovamente(ch)).toBe(true);
    const q0 = ch.confrontos.find((c) => c.id === "q0")!;
    decidirVencedor(ch, "q0", q0.a!.chave);
    expect(podeSortearNovamente(ch)).toBe(false);
  });
});

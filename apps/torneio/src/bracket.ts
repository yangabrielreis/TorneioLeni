/**
 * Lógica pura do mata-mata de 8 participantes (quartas -> semis -> final).
 * Sem DOM, sem PGlite: fácil de testar isoladamente (seção 8).
 */

export type Rodada = "quartas" | "semis" | "final";

export interface Participante {
  /** identificador único e estável: nome da equipe (chave de tema) ou id do tema (final geral) */
  chave: string;
  item: string;
  relacionado: string;
  /** equipe dona do item, para a regra "não vota no próprio item" e para o ranking geral de votos */
  equipe: string;
  /** imagem de identificação colada pelo professor (data URL), se houver */
  imagemUrl?: string;
}

export interface Confronto {
  id: string;
  rodada: Rodada;
  a?: Participante;
  b?: Participante;
  vencedor?: Participante;
  votosA?: number;
  votosB?: number;
}

export interface Chaveamento {
  semente: number;
  participantes: Participante[];
  confrontos: Confronto[];
  /** ordem em que os confrontos foram decididos, para permitir desfazer */
  decisoes: string[];
  campeao?: Participante;
}

const PROXIMO: Record<string, { alvo: string; lado: "a" | "b" }> = {
  q0: { alvo: "s0", lado: "a" },
  q1: { alvo: "s0", lado: "b" },
  q2: { alvo: "s1", lado: "a" },
  q3: { alvo: "s1", lado: "b" },
  s0: { alvo: "f0", lado: "a" },
  s1: { alvo: "f0", lado: "b" },
};

function confrontosVazios(): Confronto[] {
  return [
    { id: "q0", rodada: "quartas" },
    { id: "q1", rodada: "quartas" },
    { id: "q2", rodada: "quartas" },
    { id: "q3", rodada: "quartas" },
    { id: "s0", rodada: "semis" },
    { id: "s1", rodada: "semis" },
    { id: "f0", rodada: "final" },
  ];
}

/** PRNG determinístico e simples (mulberry32), a partir de uma semente numérica. */
function criarGeradorAleatorio(semente: number): () => number {
  let a = semente >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function embaralhar<T>(lista: T[], aleatorio: () => number): T[] {
  const copia = lista.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Sorteia um novo chaveamento de 8 participantes. Precisa de exatamente 8. */
export function sortearChaveamento(
  participantes: Participante[],
  semente: number = Date.now(),
): Chaveamento {
  if (participantes.length !== 8) {
    throw new Error("são necessários exatamente 8 participantes para o mata-mata");
  }
  const aleatorio = criarGeradorAleatorio(semente);
  const ordem = embaralhar(participantes, aleatorio);
  const confrontos = confrontosVazios();
  const quartas = confrontos.filter((c) => c.rodada === "quartas");
  quartas.forEach((confronto, i) => {
    confronto.a = ordem[i * 2];
    confronto.b = ordem[i * 2 + 1];
  });
  return { semente, participantes: ordem, confrontos, decisoes: [] };
}

/** true se nenhum confronto do chaveamento foi decidido ainda (permite sortear de novo). */
export function podeSortearNovamente(chaveamento: Chaveamento): boolean {
  return chaveamento.decisoes.length === 0;
}

export function buscarConfronto(chaveamento: Chaveamento, id: string): Confronto {
  const confronto = chaveamento.confrontos.find((c) => c.id === id);
  if (!confronto) throw new Error(`confronto "${id}" não existe`);
  return confronto;
}

/** Confrontos prontos para decisão: os dois lados definidos e ainda sem vencedor. */
export function confrontoEstaProntoParaDecisao(confronto: Confronto): boolean {
  return !!confronto.a && !!confronto.b && !confronto.vencedor;
}

/**
 * Decide o vencedor de um confronto (por chave do participante 'a' ou 'b') e o
 * propaga para o próximo confronto. Registra a decisão para permitir desfazer.
 * Não mexe em votosA/votosB: a contagem de votos é independente da decisão
 * (ver incrementarVoto) e continua registrada mesmo depois de decidido.
 */
export function decidirVencedor(chaveamento: Chaveamento, confrontoId: string, vencedorChave: string): void {
  const confronto = buscarConfronto(chaveamento, confrontoId);
  if (!confrontoEstaProntoParaDecisao(confronto)) {
    throw new Error("confronto não está pronto para decisão (falta participante ou já decidido)");
  }
  const vencedor =
    confronto.a?.chave === vencedorChave
      ? confronto.a
      : confronto.b?.chave === vencedorChave
        ? confronto.b
        : undefined;
  if (!vencedor) throw new Error("vencedor informado não participa deste confronto");

  confronto.vencedor = vencedor;
  chaveamento.decisoes.push(confrontoId);

  const proximo = PROXIMO[confrontoId];
  if (proximo) {
    const alvo = buscarConfronto(chaveamento, proximo.alvo);
    alvo[proximo.lado] = vencedor;
  } else {
    // f0: fim do chaveamento
    chaveamento.campeao = vencedor;
  }
}

/** Soma um voto (ou tira, com delta negativo) do lado indicado. Nunca fica negativo. */
export function incrementarVoto(chaveamento: Chaveamento, confrontoId: string, lado: "a" | "b", delta: number): void {
  const confronto = buscarConfronto(chaveamento, confrontoId);
  if (!confrontoEstaProntoParaDecisao(confronto)) {
    throw new Error("confronto não está pronto para votação (falta participante ou já decidido)");
  }
  const campo = lado === "a" ? "votosA" : "votosB";
  confronto[campo] = Math.max(0, (confronto[campo] ?? 0) + delta);
}

/** Calcula o vencedor a partir da contagem de votos. Retorna undefined em caso de empate. */
export function vencedorPorVotos(votosA: number, votosB: number): "a" | "b" | undefined {
  if (votosA === votosB) return undefined;
  return votosA > votosB ? "a" : "b";
}

/** Desfaz a última decisão tomada neste chaveamento (LIFO). Mantém os votos já contados. */
export function desfazerUltimaDecisao(chaveamento: Chaveamento): void {
  const ultimoId = chaveamento.decisoes.pop();
  if (!ultimoId) throw new Error("não há decisão para desfazer");
  const confronto = buscarConfronto(chaveamento, ultimoId);
  confronto.vencedor = undefined;

  const proximo = PROXIMO[ultimoId];
  if (proximo) {
    const alvo = buscarConfronto(chaveamento, proximo.alvo);
    alvo[proximo.lado] = undefined;
  } else {
    chaveamento.campeao = undefined;
  }
}

export function chaveamentoCompleto(chaveamento: Chaveamento): boolean {
  return !!chaveamento.campeao;
}

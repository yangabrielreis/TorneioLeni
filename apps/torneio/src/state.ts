import { EQUIPES, TEMAS, type NomeEquipe } from "../../../shared/themes";
import type { Chaveamento } from "./bracket";

export interface EstadoTorneio {
  /** temaId -> idFilha -> equipe dona daquele item (fonte da verdade das "vagas") */
  atribuicoes: Record<string, Record<number, NomeEquipe>>;
  /** temaId -> chaveamento do mata-mata daquele tema, quando iniciado */
  chaveamentos: Record<string, Chaveamento>;
  finalGeral?: Chaveamento;
  equipeAtiva: NomeEquipe;
  mostrarEquipeNoConfronto: boolean;
}

const CHAVE_LOCALSTORAGE = "torneio-bd:estado";

export function estadoInicial(): EstadoTorneio {
  return {
    atribuicoes: Object.fromEntries(TEMAS.map((t) => [t.id, {}])),
    chaveamentos: {},
    equipeAtiva: EQUIPES[0],
    mostrarEquipeNoConfronto: false,
  };
}

export function carregarEstado(): EstadoTorneio {
  try {
    const bruto = localStorage.getItem(CHAVE_LOCALSTORAGE);
    if (!bruto) return estadoInicial();
    const salvo = JSON.parse(bruto) as Partial<EstadoTorneio>;
    return { ...estadoInicial(), ...salvo, atribuicoes: { ...estadoInicial().atribuicoes, ...salvo.atribuicoes } };
  } catch {
    return estadoInicial();
  }
}

export function salvarEstado(estado: EstadoTorneio): void {
  localStorage.setItem(CHAVE_LOCALSTORAGE, JSON.stringify(estado));
}

export function limparEstado(): void {
  localStorage.removeItem(CHAVE_LOCALSTORAGE);
}

export function equipesComItem(estado: EstadoTorneio, temaId: string): Set<NomeEquipe> {
  return new Set(Object.values(estado.atribuicoes[temaId] ?? {}));
}

export function todosTemasComCampeao(estado: EstadoTorneio): boolean {
  return TEMAS.every((t) => !!estado.chaveamentos[t.id]?.campeao);
}

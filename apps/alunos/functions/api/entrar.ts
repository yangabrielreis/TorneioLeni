import { EQUIPES } from "../../../../shared/themes";
import type { Env } from "../_lib/env";
import { assinarToken, iguaisEmTempoConstante, normalizarSenha } from "../_lib/token";
import { hashIp, incrementarContador, ipDaRequisicao, limparContador } from "../_lib/rate-limit";

const VALIDADE_TOKEN_MS = 4 * 60 * 60 * 1000; // ~4 horas
const LIMITE_TENTATIVAS = 10;
const JANELA_TENTATIVAS_SEGUNDOS = 10 * 60;

const ERRO_GENERICO = { erro: "equipe ou senha incorreta" };

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let corpo: { equipe?: unknown; senha?: unknown };
  try {
    corpo = await context.request.json();
  } catch {
    return Response.json({ erro: "requisição inválida" }, { status: 400 });
  }

  const equipe = typeof corpo.equipe === "string" ? corpo.equipe : "";
  const senha = typeof corpo.senha === "string" ? corpo.senha : "";
  if (!equipe || !senha || senha.length > 200) {
    return Response.json(ERRO_GENERICO, { status: 401 });
  }

  const ip = ipDaRequisicao(context.request);
  const chaveContador = `tentativas:${await hashIp(ip)}:${equipe}`;

  const contadorAtual = Number((await context.env.TORNEIO_KV.get(chaveContador)) ?? "0");
  if (contadorAtual >= LIMITE_TENTATIVAS) {
    return Response.json({ erro: "muitas tentativas, aguarde alguns minutos e tente de novo" }, { status: 429 });
  }

  if (!EQUIPES.includes(equipe as (typeof EQUIPES)[number])) {
    await incrementarContador(context.env.TORNEIO_KV, chaveContador, JANELA_TENTATIVAS_SEGUNDOS);
    return Response.json(ERRO_GENERICO, { status: 401 });
  }

  let senhas: Record<string, string>;
  try {
    senhas = JSON.parse(context.env.SENHAS_EQUIPES || "{}");
  } catch {
    senhas = {};
  }
  const senhaEsperada = senhas[equipe];

  const confere = senhaEsperada ? await iguaisEmTempoConstante(normalizarSenha(senha), normalizarSenha(senhaEsperada)) : false;

  if (!confere) {
    await incrementarContador(context.env.TORNEIO_KV, chaveContador, JANELA_TENTATIVAS_SEGUNDOS);
    return Response.json(ERRO_GENERICO, { status: 401 });
  }

  await limparContador(context.env.TORNEIO_KV, chaveContador);
  const token = await assinarToken({ tipo: "equipe", equipe, exp: Date.now() + VALIDADE_TOKEN_MS }, context.env.TOKEN_SEGREDO);
  return Response.json({ token, equipe });
};

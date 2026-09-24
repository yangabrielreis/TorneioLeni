import type { Env } from "../_lib/env";
import { assinarToken, iguaisEmTempoConstante } from "../_lib/token";
import { hashIp, incrementarContador, ipDaRequisicao } from "../_lib/rate-limit";

const VALIDADE_TOKEN_MS = 8 * 60 * 60 * 1000; // 8 horas, sessão de trabalho do professor
const LIMITE_TENTATIVAS = 10;
const JANELA_TENTATIVAS_SEGUNDOS = 10 * 60;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let corpo: { senha?: unknown };
  try {
    corpo = await context.request.json();
  } catch {
    return Response.json({ erro: "requisição inválida" }, { status: 400 });
  }
  const senha = typeof corpo.senha === "string" ? corpo.senha : "";

  const ip = ipDaRequisicao(context.request);
  const chaveContador = `tentativas-admin:${await hashIp(ip)}`;
  const contadorAtual = Number((await context.env.TORNEIO_KV.get(chaveContador)) ?? "0");
  if (contadorAtual >= LIMITE_TENTATIVAS) {
    return Response.json({ erro: "muitas tentativas, aguarde alguns minutos" }, { status: 429 });
  }

  const confere = senha ? await iguaisEmTempoConstante(senha, context.env.ADMIN_SENHA || "") : false;
  if (!confere) {
    await incrementarContador(context.env.TORNEIO_KV, chaveContador, JANELA_TENTATIVAS_SEGUNDOS);
    return Response.json({ erro: "senha incorreta" }, { status: 401 });
  }

  const token = await assinarToken({ tipo: "admin", exp: Date.now() + VALIDADE_TOKEN_MS }, context.env.TOKEN_SEGREDO);
  return Response.json({ token });
};

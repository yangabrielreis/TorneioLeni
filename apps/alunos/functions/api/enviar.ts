import type { Env } from "../_lib/env";
import { verificarToken } from "../_lib/token";
import { incrementarContador } from "../_lib/rate-limit";
import type { Submissao } from "../../../../shared/types";

const TAMANHO_MAXIMO_SQL_BYTES = 20 * 1024;
const LIMITE_ENVIOS_POR_HORA = 30;
const HISTORICO_MAXIMO = 50;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const cabecalho = context.request.headers.get("Authorization") ?? "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice("Bearer ".length) : null;
  const payload = await verificarToken(token, context.env.TOKEN_SEGREDO);
  if (!payload || payload.tipo !== "equipe") {
    return Response.json({ erro: "sessão inválida ou expirada, entre de novo" }, { status: 401 });
  }
  const equipe = payload.equipe;

  let corpo: { sql?: unknown; testeOk?: unknown; testeMensagem?: unknown; honeypot?: unknown };
  try {
    corpo = await context.request.json();
  } catch {
    return Response.json({ erro: "requisição inválida" }, { status: 400 });
  }

  // honeypot: campo que só um bot preencheria. Finge sucesso, mas não grava nada.
  if (typeof corpo.honeypot === "string" && corpo.honeypot.trim() !== "") {
    return Response.json({ ok: true, enviadoEm: new Date().toISOString() });
  }

  const sql = typeof corpo.sql === "string" ? corpo.sql : "";
  if (new TextEncoder().encode(sql).length > TAMANHO_MAXIMO_SQL_BYTES) {
    return Response.json({ erro: "o script passou do tamanho máximo (20 KB)" }, { status: 413 });
  }

  const chaveLimite = `envios-hora:${equipe}`;
  const total = await incrementarContador(context.env.TORNEIO_KV, chaveLimite, 60 * 60);
  if (total > LIMITE_ENVIOS_POR_HORA) {
    return Response.json({ erro: "muitos envios nessa última hora, tente de novo mais tarde" }, { status: 429 });
  }

  const submissao: Submissao = {
    sql,
    enviadoEm: new Date().toISOString(),
    ok: corpo.testeOk === true,
    mensagem: typeof corpo.testeMensagem === "string" ? corpo.testeMensagem.slice(0, 2000) : undefined,
  };

  const chaveAtual = `submissao:${equipe}`;
  const chaveHistorico = `historico:${equipe}`;

  const historicoBruto = await context.env.TORNEIO_KV.get(chaveHistorico);
  const historico: Submissao[] = historicoBruto ? JSON.parse(historicoBruto) : [];
  historico.unshift(submissao);
  if (historico.length > HISTORICO_MAXIMO) historico.length = HISTORICO_MAXIMO;

  await Promise.all([
    context.env.TORNEIO_KV.put(chaveAtual, JSON.stringify(submissao)),
    context.env.TORNEIO_KV.put(chaveHistorico, JSON.stringify(historico)),
  ]);

  return Response.json({ ok: true, enviadoEm: submissao.enviadoEm });
};

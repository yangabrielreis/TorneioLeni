import { EQUIPES } from "../../../../shared/themes";
import type { Env } from "../_lib/env";
import { exigirAdmin } from "../_lib/admin-auth";
import type { Submissao } from "../../../../shared/types";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const negado = await exigirAdmin(context.request, context.env);
  if (negado) return negado;

  const url = new URL(context.request.url);
  const equipe = url.searchParams.get("equipe") ?? "";
  if (!EQUIPES.includes(equipe as (typeof EQUIPES)[number])) {
    return Response.json({ erro: "equipe desconhecida" }, { status: 404 });
  }

  const atual = await context.env.TORNEIO_KV.get(`submissao:${equipe}`);
  const historicoBruto = await context.env.TORNEIO_KV.get(`historico:${equipe}`);

  return Response.json({
    equipe,
    atual: atual ? (JSON.parse(atual) as Submissao) : null,
    historico: historicoBruto ? (JSON.parse(historicoBruto) as Submissao[]) : [],
  });
};

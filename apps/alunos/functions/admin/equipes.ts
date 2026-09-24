import { EQUIPES } from "../../../../shared/themes";
import type { Env } from "../_lib/env";
import { exigirAdmin } from "../_lib/admin-auth";
import type { Submissao, StatusEquipe } from "../../../../shared/types";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const negado = await exigirAdmin(context.request, context.env);
  if (negado) return negado;

  const status: StatusEquipe[] = await Promise.all(
    EQUIPES.map(async (equipe): Promise<StatusEquipe> => {
      const bruto = await context.env.TORNEIO_KV.get(`submissao:${equipe}`);
      if (!bruto) return { equipe, enviou: false, ok: null, ultimoEnvio: null };
      const submissao = JSON.parse(bruto) as Submissao;
      return { equipe, enviou: true, ok: submissao.ok, ultimoEnvio: submissao.enviadoEm };
    }),
  );

  return Response.json({ equipes: status });
};

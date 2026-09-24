import type { Env } from "../_lib/env";
import { exigirAdmin } from "../_lib/admin-auth";

/**
 * Apaga todos os envios (atual + histórico) de todas as equipes. Não mexe
 * nos contadores de tentativas/limite — esses já expiram sozinhos (TTL).
 * Use antes de uma aula nova, pra tirar envios de teste do painel.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const negado = await exigirAdmin(context.request, context.env);
  if (negado) return negado;

  let apagadas = 0;
  for (const prefixo of ["submissao:", "historico:"]) {
    let cursor: string | undefined;
    do {
      const listagem = await context.env.TORNEIO_KV.list({ prefix: prefixo, cursor });
      for (const chave of listagem.keys) {
        await context.env.TORNEIO_KV.delete(chave.name);
        apagadas++;
      }
      cursor = listagem.list_complete ? undefined : listagem.cursor;
    } while (cursor);
  }

  return Response.json({ ok: true, apagadas });
};

import { zipSync, strToU8 } from "fflate";
import { EQUIPES } from "../../../../shared/themes";
import type { Env } from "../_lib/env";
import { exigirAdmin } from "../_lib/admin-auth";
import type { Submissao } from "../../../../shared/types";

function nomeArquivo(equipe: string): string {
  const semAcentos = equipe
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${semAcentos}.sql`;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const negado = await exigirAdmin(context.request, context.env);
  if (negado) return negado;

  const arquivos: Record<string, Uint8Array> = {};
  for (const equipe of EQUIPES) {
    const bruto = await context.env.TORNEIO_KV.get(`submissao:${equipe}`);
    if (!bruto) continue;
    const submissao = JSON.parse(bruto) as Submissao;
    arquivos[nomeArquivo(equipe)] = strToU8(submissao.sql);
  }

  const zipado = zipSync(arquivos, { level: 6 });
  return new Response(zipado as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="envios-torneio-bd.zip"',
    },
  });
};

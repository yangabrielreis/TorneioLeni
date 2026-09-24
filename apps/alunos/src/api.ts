export interface RespostaEntrar {
  token: string;
  equipe: string;
}

export async function entrar(equipe: string, senha: string): Promise<RespostaEntrar> {
  const r = await fetch("/api/entrar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ equipe, senha }),
  });
  const dados = (await r.json().catch(() => ({}))) as Partial<RespostaEntrar> & { erro?: string };
  if (!r.ok) throw new Error(dados.erro ?? "não foi possível entrar");
  return dados as RespostaEntrar;
}

export interface RespostaEnviar {
  ok: true;
  enviadoEm: string;
}

export async function enviarScript(params: {
  token: string;
  sql: string;
  testeOk?: boolean;
  testeMensagem?: string;
  honeypot: string;
}): Promise<RespostaEnviar> {
  const r = await fetch("/api/enviar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${params.token}` },
    body: JSON.stringify({
      sql: params.sql,
      testeOk: params.testeOk,
      testeMensagem: params.testeMensagem,
      honeypot: params.honeypot,
    }),
  });
  const dados = (await r.json().catch(() => ({}))) as Partial<RespostaEnviar> & { erro?: string };
  if (!r.ok) throw new Error(dados.erro ?? "não foi possível enviar");
  return dados as RespostaEnviar;
}

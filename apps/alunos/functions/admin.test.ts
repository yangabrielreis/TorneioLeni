import { describe, expect, it } from "vitest";
import { onRequestPost as login } from "./admin/login";
import { onRequestPost as limpar } from "./admin/limpar";
import type { Env } from "./_lib/env";

function criarKvFalsa() {
  const dados = new Map<string, string>();
  return {
    async get(chave: string) {
      return dados.has(chave) ? dados.get(chave)! : null;
    },
    async put(chave: string, valor: string) {
      dados.set(chave, valor);
    },
    async delete(chave: string) {
      dados.delete(chave);
    },
    async list({ prefix, cursor }: { prefix?: string; cursor?: string } = {}) {
      const chaves = [...dados.keys()]
        .filter((k) => !prefix || k.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys: chaves, list_complete: true, cursor: undefined };
    },
    _dados: dados,
  } as any;
}

function criarEnv(kv = criarKvFalsa()): Env & { TORNEIO_KV: ReturnType<typeof criarKvFalsa> } {
  return {
    TORNEIO_KV: kv,
    SENHAS_EQUIPES: "{}",
    ADMIN_SENHA: "senha-do-professor-teste",
    TOKEN_SEGREDO: "segredo-de-teste-bem-grande-e-aleatorio",
  };
}

function requisicao(corpo: unknown = {}, cabecalhos: Record<string, string> = {}): Request {
  return new Request("http://local.test/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cabecalhos },
    body: JSON.stringify(corpo),
  });
}

function contexto(request: Request, env: Env) {
  return { request, env, params: {}, data: {}, functionPath: "", next: async () => new Response(), waitUntil: () => {} } as any;
}

describe("POST /admin/limpar", () => {
  it("sem token de admin é recusado", async () => {
    const env = criarEnv();
    const r = await limpar(contexto(requisicao(), env));
    expect(r.status).toBe(401);
  });

  it("apaga submissao:* e historico:* de todas as equipes, sem mexer em outras chaves", async () => {
    const kv = criarKvFalsa();
    const env = criarEnv(kv);

    await kv.put("submissao:Oreia", JSON.stringify({ sql: "SELECT 1;", enviadoEm: "x", ok: true }));
    await kv.put("historico:Oreia", JSON.stringify([{ sql: "SELECT 1;", enviadoEm: "x", ok: true }]));
    await kv.put("submissao:Marcelita", JSON.stringify({ sql: "SELECT 2;", enviadoEm: "y", ok: false }));
    await kv.put("tentativas:abc:Oreia", "3"); // não deve ser apagada

    const rLogin = await login(contexto(requisicao({ senha: "senha-do-professor-teste" }), env));
    const { token } = (await rLogin.json()) as { token: string };

    const r = await limpar(contexto(requisicao({}, { Authorization: `Bearer ${token}` }), env));
    expect(r.status).toBe(200);
    const dados = (await r.json()) as { ok: true; apagadas: number };
    expect(dados.apagadas).toBe(3);

    expect(await kv.get("submissao:Oreia")).toBeNull();
    expect(await kv.get("historico:Oreia")).toBeNull();
    expect(await kv.get("submissao:Marcelita")).toBeNull();
    expect(await kv.get("tentativas:abc:Oreia")).toBe("3");
  });
});

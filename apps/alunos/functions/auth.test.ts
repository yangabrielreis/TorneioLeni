import { describe, expect, it } from "vitest";
import { EQUIPES } from "../../../shared/themes";
import { onRequestPost as entrar } from "./api/entrar";
import { onRequestPost as enviar } from "./api/enviar";
import { assinarToken, verificarToken } from "./_lib/token";
import type { Env } from "./_lib/env";

/** KV em memória só para os testes, com suporte mínimo às operações usadas pelo código. */
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
  } as any;
}

const SENHAS_TESTE: Record<string, string> = Object.fromEntries(EQUIPES.map((e, i) => [e, `teste-palavra-${i}`]));

function criarEnv(kv = criarKvFalsa()): Env {
  return {
    TORNEIO_KV: kv,
    SENHAS_EQUIPES: JSON.stringify(SENHAS_TESTE),
    ADMIN_SENHA: "senha-do-professor-teste",
    TOKEN_SEGREDO: "segredo-de-teste-bem-grande-e-aleatorio",
  };
}

function requisicao(corpo: unknown, cabecalhos: Record<string, string> = {}): Request {
  return new Request("http://local.test/api", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cabecalhos },
    body: JSON.stringify(corpo),
  });
}

function contexto(request: Request, env: Env) {
  return { request, env, params: {}, data: {}, functionPath: "", next: async () => new Response(), waitUntil: () => {} } as any;
}

describe("POST /api/entrar", () => {
  it("senha correta entra, ignorando maiúsculas e espaços nas pontas", async () => {
    const env = criarEnv();
    const r = await entrar(contexto(requisicao({ equipe: "Oreia", senha: `  ${SENHAS_TESTE["Oreia"].toUpperCase()}  ` }), env));
    expect(r.status).toBe(200);
    const dados = (await r.json()) as { token: string };
    expect(dados.token).toBeTruthy();
    const payload = await verificarToken(dados.token, env.TOKEN_SEGREDO);
    expect(payload).toMatchObject({ tipo: "equipe", equipe: "Oreia" });
  });

  it("senha errada retorna 401 com mensagem genérica", async () => {
    const env = criarEnv();
    const r = await entrar(contexto(requisicao({ equipe: "Oreia", senha: "chuta-qualquer-coisa" }), env));
    expect(r.status).toBe(401);
    const dados = (await r.json()) as { erro: string };
    expect(dados.erro).toBe("equipe ou senha incorreta");
  });

  it("depois de 10 tentativas erradas, a 11ª retorna 429", async () => {
    const env = criarEnv();
    let ultimoStatus = 0;
    for (let i = 0; i < 11; i++) {
      const r = await entrar(contexto(requisicao({ equipe: "Oreia", senha: "errada" }), env));
      ultimoStatus = r.status;
    }
    expect(ultimoStatus).toBe(429);
  });
});

describe("POST /api/enviar", () => {
  it("o token de uma equipe só grava a submissão para ela mesma (nunca para outra)", async () => {
    const env = criarEnv();
    const rLogin = await entrar(contexto(requisicao({ equipe: "Marcelita", senha: SENHAS_TESTE["Marcelita"] }), env));
    const { token } = (await rLogin.json()) as { token: string };

    const rEnviar = await enviar(contexto(requisicao({ sql: "SELECT 1;" }, { Authorization: `Bearer ${token}` }), env));
    expect(rEnviar.status).toBe(200);

    const gravado = await env.TORNEIO_KV.get("submissao:Marcelita");
    expect(gravado).toBeTruthy();
    const outraEquipe = await env.TORNEIO_KV.get("submissao:Oreia");
    expect(outraEquipe).toBeNull();
  });

  it("token expirado é recusado", async () => {
    const env = criarEnv();
    const tokenExpirado = await assinarToken({ tipo: "equipe", equipe: "Oreia", exp: Date.now() - 1000 }, env.TOKEN_SEGREDO);
    const r = await enviar(contexto(requisicao({ sql: "SELECT 1;" }, { Authorization: `Bearer ${tokenExpirado}` }), env));
    expect(r.status).toBe(401);
  });

  it("sem token (ou token inválido) é recusado", async () => {
    const env = criarEnv();
    const semToken = await enviar(contexto(requisicao({ sql: "SELECT 1;" }), env));
    expect(semToken.status).toBe(401);

    const tokenQuebrado = await enviar(
      contexto(requisicao({ sql: "SELECT 1;" }, { Authorization: "Bearer isso.nao-e-um-token" }), env),
    );
    expect(tokenQuebrado.status).toBe(401);
  });
});

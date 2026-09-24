/** Limite de tentativas simples baseado em contador na KV, com expiração automática. */
export async function incrementarContador(kv: KVNamespace, chave: string, ttlSegundos: number): Promise<number> {
  const atual = Number((await kv.get(chave)) ?? "0");
  const novo = atual + 1;
  await kv.put(chave, String(novo), { expirationTtl: ttlSegundos });
  return novo;
}

export async function limparContador(kv: KVNamespace, chave: string): Promise<void> {
  await kv.delete(chave);
}

/** Hash curto do IP (nunca guardamos o IP em claro), usado só como parte da chave do limite de tentativas. */
export async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function ipDaRequisicao(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "desconhecido";
}

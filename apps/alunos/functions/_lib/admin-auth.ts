import type { Env } from "./env";
import { verificarToken } from "./token";

/** Retorna null se o pedido tem um token de admin válido, ou a Response de erro para devolver direto. */
export async function exigirAdmin(request: Request, env: Env): Promise<Response | null> {
  const cabecalho = request.headers.get("Authorization") ?? "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice("Bearer ".length) : null;
  const payload = await verificarToken(token, env.TOKEN_SEGREDO);
  if (!payload || payload.tipo !== "admin") {
    return Response.json({ erro: "acesso restrito ao professor" }, { status: 401 });
  }
  return null;
}

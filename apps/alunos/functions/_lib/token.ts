/**
 * Token de sessão assinado com HMAC-SHA256 (sem bibliotecas externas, só Web Crypto).
 * Formato: base64url(JSON do payload) + "." + base64url(assinatura).
 */

export interface PayloadEquipe {
  tipo: "equipe";
  equipe: string;
  exp: number;
}

export interface PayloadAdmin {
  tipo: "admin";
  exp: number;
}

export type Payload = PayloadEquipe | PayloadAdmin;

function base64url(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let binario = "";
  for (const b of arr) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(texto: string): Uint8Array {
  const normalizado = texto.replace(/-/g, "+").replace(/_/g, "/");
  const preenchido = normalizado + "=".repeat((4 - (normalizado.length % 4)) % 4);
  const binario = atob(preenchido);
  const arr = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) arr[i] = binario.charCodeAt(i);
  return arr;
}

async function chaveHmac(segredo: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function assinarToken(payload: Payload, segredo: string): Promise<string> {
  const corpo = base64url(new TextEncoder().encode(JSON.stringify(payload)).buffer as ArrayBuffer);
  const chave = await chaveHmac(segredo);
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpo));
  return `${corpo}.${base64url(assinatura)}`;
}

export async function verificarToken(token: string | null | undefined, segredo: string): Promise<Payload | null> {
  if (!token) return null;
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [corpo, assinatura] = partes;

  const chave = await chaveHmac(segredo);
  let assinaturaBytes: Uint8Array;
  try {
    assinaturaBytes = base64urlDecode(assinatura);
  } catch {
    return null;
  }
  const valido = await crypto.subtle.verify("HMAC", chave, assinaturaBytes, new TextEncoder().encode(corpo));
  if (!valido) return null;

  try {
    const texto = new TextDecoder().decode(base64urlDecode(corpo));
    const payload = JSON.parse(texto) as Payload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Compara duas strings em tempo constante (via hash de tamanho fixo, evita vazamento por tempo). */
export async function iguaisEmTempoConstante(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(a)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(b)),
  ]);
  const bytesA = new Uint8Array(hashA);
  const bytesB = new Uint8Array(hashB);
  let diferenca = 0;
  for (let i = 0; i < bytesA.length; i++) diferenca |= bytesA[i] ^ bytesB[i];
  return diferenca === 0;
}

export function normalizarSenha(senha: string): string {
  return senha.trim().toLowerCase();
}

/**
 * Imagem de identificação de cada item, colada (Ctrl+V) pelo professor.
 * Não faz parte do banco pedido aos alunos — é só um apoio visual local,
 * guardado no navegador (localStorage, como um data URL JPEG pequeno).
 */

const PREFIXO = "torneio-bd:imagem:";
const LADO_MAXIMO = 260;
const QUALIDADE_JPEG = 0.72;

function chave(temaId: string, idFilha: number): string {
  return `${PREFIXO}${temaId}:${idFilha}`;
}

export function salvarImagem(temaId: string, idFilha: number, dataUrl: string): void {
  try {
    localStorage.setItem(chave(temaId, idFilha), dataUrl);
  } catch {
    // localStorage cheio: a imagem é só um apoio visual, então falha em silêncio.
  }
}

export function obterImagem(temaId: string, idFilha: number): string | null {
  return localStorage.getItem(chave(temaId, idFilha));
}

export function removerImagem(temaId: string, idFilha: number): void {
  localStorage.removeItem(chave(temaId, idFilha));
}

/**
 * Remove todas as imagens guardadas. Precisa ser chamado em "Reiniciar tudo":
 * como o banco reinicia os ids (SERIAL) do zero, uma imagem antiga não apagada
 * reapareceria "colada" num item novo e completamente diferente que caísse no
 * mesmo id.
 */
export function limparTodasImagens(): void {
  const chavesParaRemover: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i);
    if (chave?.startsWith(PREFIXO)) chavesParaRemover.push(chave);
  }
  for (const chave of chavesParaRemover) localStorage.removeItem(chave);
}

/** Redimensiona/comprime uma imagem colada para um data URL JPEG pequeno. */
export async function prepararImagemColada(arquivo: Blob): Promise<string> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", QUALIDADE_JPEG);
}

/** Extrai a primeira imagem de um evento de colar (Ctrl+V), se houver. */
export function extrairImagemDoColar(ev: ClipboardEvent): Blob | null {
  const itens = ev.clipboardData?.items;
  if (!itens) return null;
  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];
    if (item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  return null;
}

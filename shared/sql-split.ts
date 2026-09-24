/**
 * Divide um texto SQL em comandos completos (terminados em ";" fora de aspas
 * simples) e o restante ainda incompleto. Usado tanto pelo console do app do
 * torneio quanto pela verificação do script dos alunos.
 */
export function dividirEmComandos(buffer: string): { completos: string[]; resto: string } {
  const completos: string[] = [];
  let atual = "";
  let emAspas = false;
  for (const ch of buffer) {
    atual += ch;
    if (ch === "'") emAspas = !emAspas;
    if (ch === ";" && !emAspas) {
      completos.push(atual.trim());
      atual = "";
    }
  }
  return { completos, resto: atual };
}

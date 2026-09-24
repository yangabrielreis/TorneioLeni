/**
 * Divide um texto SQL em comandos completos (terminados em ";" fora de aspas
 * simples e fora de comentários) e o restante ainda incompleto. Usado tanto
 * pelo console do app do torneio quanto pela verificação do script dos alunos.
 *
 * Reconhece comentários (`-- até o fim da linha` e `/* bloco * /`), pra um
 * ';' ou um apóstrofo dentro de um comentário (ex.: "-- não separa aqui;")
 * não confundir a divisão dos comandos.
 */
export function dividirEmComandos(buffer: string): { completos: string[]; resto: string } {
  const completos: string[] = [];
  let atual = "";
  let emAspas = false;
  let i = 0;

  while (i < buffer.length) {
    const ch = buffer[i];
    const prox = buffer[i + 1];

    if (!emAspas && ch === "-" && prox === "-") {
      const fimLinha = buffer.indexOf("\n", i);
      const fim = fimLinha === -1 ? buffer.length : fimLinha + 1;
      atual += buffer.slice(i, fim);
      i = fim;
      continue;
    }

    if (!emAspas && ch === "/" && prox === "*") {
      const fimBloco = buffer.indexOf("*/", i + 2);
      const fim = fimBloco === -1 ? buffer.length : fimBloco + 2;
      atual += buffer.slice(i, fim);
      i = fim;
      continue;
    }

    atual += ch;
    if (ch === "'") emAspas = !emAspas;
    if (ch === ";" && !emAspas) {
      completos.push(atual.trim());
      atual = "";
    }
    i++;
  }

  return { completos, resto: atual };
}

/** Remove comentários SQL (`--` até o fim da linha, e `/* ... * /`), respeitando aspas simples. */
export function removerComentariosSql(sql: string): string {
  let resultado = "";
  let emAspas = false;
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const prox = sql[i + 1];

    if (!emAspas && ch === "-" && prox === "-") {
      const fimLinha = sql.indexOf("\n", i);
      if (fimLinha === -1) break;
      resultado += "\n";
      i = fimLinha + 1;
      continue;
    }

    if (!emAspas && ch === "/" && prox === "*") {
      const fimBloco = sql.indexOf("*/", i + 2);
      i = fimBloco === -1 ? sql.length : fimBloco + 2;
      continue;
    }

    if (ch === "'") emAspas = !emAspas;
    resultado += ch;
    i++;
  }

  return resultado;
}

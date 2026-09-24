import type { ResultadoVerificacao } from "../../../shared/schema-check";

function escaparHtml(texto: string): string {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function tabelaHtml(fields: { name: string }[], rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return `<p>(nenhuma linha)</p>`;
  const cabecalho = fields.map((f) => `<th>${escaparHtml(f.name)}</th>`).join("");
  const linhas = rows
    .map((row) => `<tr>${fields.map((f) => `<td>${escaparHtml(String(row[f.name] ?? ""))}</td>`).join("")}</tr>`)
    .join("");
  return `<table class="resultado"><thead><tr>${cabecalho}</tr></thead><tbody>${linhas}</tbody></table>`;
}

export function renderizarResultadoVerificacao(resultado: ResultadoVerificacao): string {
  const blocoErro = resultado.erro
    ? `<div class="erro-postgres">ERROR:  ${escaparHtml(resultado.erro.message)}${
        resultado.erro.detail ? `\nDETAIL:  ${escaparHtml(resultado.erro.detail)}` : ""
      }</div>`
    : "";

  const blocoSelect = resultado.ultimoSelect
    ? `<h3>Resultado do último SELECT</h3>${tabelaHtml(resultado.ultimoSelect.fields, resultado.ultimoSelect.rows)}`
    : `<p class="rotulo-pequeno">Nenhum SELECT foi executado ainda.</p>`;

  const itensChecklist = resultado.checklist
    .map(
      (item) =>
        `<li><span class="marca ${item.ok ? "ok" : "falta"}">${item.ok ? "✓" : "✗"}</span> <span>${escaparHtml(item.rotulo)}</span></li>`,
    )
    .join("");

  const mensagens =
    resultado.mensagens.length > 0
      ? `<div class="mensagens-ajuda">${resultado.mensagens.map((m) => `<div>${escaparHtml(m)}</div>`).join("")}</div>`
      : "";

  return `
    ${blocoErro}
    <div class="painel-resultado">
      <h3>Checklist</h3>
      <ul class="checklist">${itensChecklist}</ul>
      ${mensagens}
    </div>
    <div class="painel-resultado">
      ${blocoSelect}
    </div>
  `;
}

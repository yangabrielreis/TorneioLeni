import "./style.css";
import { TEMAS } from "../../../shared/themes";
import { testarScript } from "./testar";
import { renderizarResultadoVerificacao } from "./render-resultado";
import type { StatusEquipe, Submissao } from "../../../shared/types";

const CHAVE_TOKEN = "torneio-admin:token";
const app = document.getElementById("app")!;

function token(): string | null {
  return sessionStorage.getItem(CHAVE_TOKEN);
}

function salvarToken(t: string): void {
  sessionStorage.setItem(CHAVE_TOKEN, t);
}

function limparToken(): void {
  sessionStorage.removeItem(CHAVE_TOKEN);
}

async function chamarApi<T>(caminho: string): Promise<T> {
  const r = await fetch(caminho, { headers: { Authorization: `Bearer ${token()}` } });
  if (r.status === 401) {
    limparToken();
    renderizarLogin();
    throw new Error("sessão expirada");
  }
  const dados = await r.json();
  if (!r.ok) throw new Error(dados.erro ?? "erro ao consultar a API");
  return dados as T;
}

function renderizarLogin(): void {
  app.innerHTML = `
    <div class="caixa-login">
      <h1>Painel do professor</h1>
      <form id="form-login-admin">
        <div class="campo">
          <label for="input-senha-admin">Senha de admin</label>
          <input id="input-senha-admin" type="password" autocomplete="off" required />
        </div>
        <button type="submit" class="primario">Entrar</button>
        <div class="mensagem-erro" id="mensagem-erro-admin"></div>
      </form>
    </div>
  `;
  const form = document.getElementById("form-login-admin") as HTMLFormElement;
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const senha = (document.getElementById("input-senha-admin") as HTMLInputElement).value;
    const mensagemErro = document.getElementById("mensagem-erro-admin")!;
    try {
      const r = await fetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro ?? "não foi possível entrar");
      salvarToken(dados.token);
      renderizarPainel();
    } catch (e) {
      mensagemErro.textContent = (e as Error).message;
    }
  });
}

function badgeEquipe(status: StatusEquipe): string {
  if (!status.enviou) return `<span class="badge nao-enviou">não enviou</span>`;
  return status.ok
    ? `<span class="badge enviou-ok">enviou ok</span>`
    : `<span class="badge enviou-erro">enviou com erros</span>`;
}

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

async function renderizarPainel(): Promise<void> {
  app.innerHTML = `
    <div class="topo">
      <h1>Painel do professor</h1>
      <div class="linha-acoes">
        <button id="botao-zip">Baixar todos (.zip)</button>
        <button id="botao-limpar" class="perigo">Limpar todos os envios</button>
        <button data-action="sair">Sair</button>
      </div>
    </div>
    <div class="conteudo">
      <div id="area-lista">Carregando equipes…</div>
      <div id="area-detalhe"></div>
    </div>
  `;

  document.querySelector("[data-action='sair']")!.addEventListener("click", () => {
    limparToken();
    renderizarLogin();
  });

  document.getElementById("botao-zip")!.addEventListener("click", async () => {
    const r = await fetch("/admin/zip", { headers: { Authorization: `Bearer ${token()}` } });
    if (!r.ok) {
      alert("Não foi possível baixar o zip.");
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "envios-torneio-bd.zip";
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("botao-limpar")!.addEventListener("click", async () => {
    if (!confirm("Isso apaga TODOS os envios (e o histórico) de todas as equipes. Não pode ser desfeito. Continuar?")) return;
    const r = await fetch("/admin/limpar", { method: "POST", headers: { Authorization: `Bearer ${token()}` } });
    if (!r.ok) {
      alert("Não foi possível limpar os envios.");
      return;
    }
    document.getElementById("area-detalhe")!.innerHTML = "";
    renderizarPainel();
  });

  try {
    const dados = await chamarApi<{ equipes: StatusEquipe[] }>("/admin/equipes");
    const areaLista = document.getElementById("area-lista")!;
    areaLista.innerHTML = `
      <table class="tabela-equipes">
        <thead><tr><th>Equipe</th><th>Status</th><th>Último envio</th><th></th></tr></thead>
        <tbody>
          ${dados.equipes
            .map(
              (e) => `<tr>
                <td>${e.equipe}</td>
                <td>${badgeEquipe(e)}</td>
                <td>${formatarData(e.ultimoEnvio)}</td>
                <td><button data-ver-equipe="${e.equipe}">Ver</button></td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    `;
    areaLista.querySelectorAll<HTMLButtonElement>("[data-ver-equipe]").forEach((botao) => {
      botao.addEventListener("click", () => renderizarDetalheEquipe(botao.dataset.verEquipe!));
    });
  } catch (e) {
    document.getElementById("area-lista")!.innerHTML = `<div class="mensagem-erro">${(e as Error).message}</div>`;
  }
}

async function renderizarDetalheEquipe(equipe: string): Promise<void> {
  const areaDetalhe = document.getElementById("area-detalhe")!;
  areaDetalhe.innerHTML = "<p>Carregando…</p>";

  const dados = await chamarApi<{ equipe: string; atual: Submissao | null; historico: Submissao[] }>(
    `/admin/sql?equipe=${encodeURIComponent(equipe)}`,
  );

  if (!dados.atual) {
    areaDetalhe.innerHTML = `<div class="painel-resultado"><h3>${equipe}</h3><p>Esta equipe ainda não enviou nada.</p></div>`;
    return;
  }

  areaDetalhe.innerHTML = `
    <div class="painel-resultado">
      <h3>${equipe} — enviado em ${formatarData(dados.atual.enviadoEm)}</h3>
      <pre class="sql-texto" id="texto-sql">${escaparHtml(dados.atual.sql)}</pre>
      <div class="linha-acoes">
        <button id="botao-copiar">Copiar</button>
        <button id="botao-baixar">Baixar .sql</button>
        <button id="botao-testar-aqui">Testar aqui</button>
      </div>
      <div id="area-teste-admin"></div>
      ${
        dados.historico.length > 1
          ? `<h3>Histórico (${dados.historico.length} envios)</h3>
             <ul>${dados.historico
               .map((s) => `<li>${formatarData(s.enviadoEm)} — ${s.ok ? "ok" : "com erros"}</li>`)
               .join("")}</ul>`
          : ""
      }
    </div>
  `;

  document.getElementById("botao-copiar")!.addEventListener("click", async () => {
    await navigator.clipboard.writeText(dados.atual!.sql);
  });

  document.getElementById("botao-baixar")!.addEventListener("click", () => {
    const blob = new Blob([dados.atual!.sql], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${equipe}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("botao-testar-aqui")!.addEventListener("click", async () => {
    const tema = TEMAS.find((t) => t.equipeDona === equipe);
    if (!tema) return;
    const areaTeste = document.getElementById("area-teste-admin")!;
    areaTeste.innerHTML = "<p>Testando…</p>";
    const resultado = await testarScript(tema, dados.atual!.sql);
    areaTeste.innerHTML = renderizarResultadoVerificacao(resultado);
  });
}

function escaparHtml(texto: string): string {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

if (token()) {
  renderizarPainel();
} else {
  renderizarLogin();
}

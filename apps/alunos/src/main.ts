import "./style.css";
import { EQUIPES, TEMAS } from "../../../shared/themes";
import { entrar, enviarScript } from "./api";
import { testarScript, pgliteEstaIndisponivel } from "./testar";
import { renderizarResultadoVerificacao } from "./render-resultado";
import type { ResultadoVerificacao } from "../../../shared/schema-check";

const CHAVE_TOKEN = "torneio-alunos:token";
const CHAVE_EQUIPE = "torneio-alunos:equipe";

const app = document.getElementById("app")!;

function sessaoAtual(): { token: string; equipe: string } | null {
  const token = sessionStorage.getItem(CHAVE_TOKEN);
  const equipe = sessionStorage.getItem(CHAVE_EQUIPE);
  if (!token || !equipe) return null;
  return { token, equipe };
}

function salvarSessao(token: string, equipe: string): void {
  sessionStorage.setItem(CHAVE_TOKEN, token);
  sessionStorage.setItem(CHAVE_EQUIPE, equipe);
}

function limparSessao(): void {
  sessionStorage.removeItem(CHAVE_TOKEN);
  sessionStorage.removeItem(CHAVE_EQUIPE);
}

function renderizarLogin(): void {
  app.innerHTML = `
    <div class="caixa-login">
      <h1>Torneio de Banco de Dados</h1>
      <form id="form-login">
        <div class="campo">
          <label for="select-equipe">Equipe</label>
          <select id="select-equipe" required>
            <option value="" disabled selected>Selecione sua equipe</option>
            ${EQUIPES.map((e) => `<option value="${e}">${e}</option>`).join("")}
          </select>
        </div>
        <div class="campo">
          <label for="input-senha">Senha da equipe</label>
          <input id="input-senha" type="password" autocomplete="off" required />
        </div>
        <div class="campo campo-honeypot" aria-hidden="true">
          <label for="input-site">Deixe em branco</label>
          <input id="input-site" name="site" type="text" tabindex="-1" autocomplete="off" />
        </div>
        <button type="submit" class="primario">Entrar</button>
        <div class="mensagem-erro" id="mensagem-erro"></div>
      </form>
    </div>
  `;

  const form = document.getElementById("form-login") as HTMLFormElement;
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const equipe = (document.getElementById("select-equipe") as HTMLSelectElement).value;
    const senha = (document.getElementById("input-senha") as HTMLInputElement).value;
    const mensagemErro = document.getElementById("mensagem-erro")!;
    mensagemErro.textContent = "";
    try {
      const resposta = await entrar(equipe, senha);
      salvarSessao(resposta.token, resposta.equipe);
      renderizarTelaAluno();
    } catch (e) {
      mensagemErro.textContent = (e as Error).message;
    }
  });
}

function renderizarTelaAluno(): void {
  const sessao = sessaoAtual();
  if (!sessao) {
    renderizarLogin();
    return;
  }
  const tema = TEMAS.find((t) => t.equipeDona === sessao.equipe);
  if (!tema) {
    limparSessao();
    renderizarLogin();
    return;
  }

  app.innerHTML = `
    <div class="topo">
      <h1>${sessao.equipe} — ${tema.nome}</h1>
      <button data-action="sair">Sair</button>
    </div>
    <div class="conteudo">
      <div class="campo">
        <label for="editor-sql">Seu script SQL</label>
        <textarea id="editor-sql" rows="14" spellcheck="false" placeholder="Digite aqui o SQL do exercício impresso…"></textarea>
      </div>
      <div class="campo campo-honeypot" aria-hidden="true">
        <label for="input-site-2">Deixe em branco</label>
        <input id="input-site-2" type="text" tabindex="-1" autocomplete="off" />
      </div>
      <div class="linha-acoes">
        <button id="botao-testar" class="primario">Testar</button>
        <button id="botao-enviar">Enviar</button>
      </div>
      <div id="area-mensagem"></div>
      <div id="area-resultado"></div>
    </div>
  `;

  document.querySelector("[data-action='sair']")!.addEventListener("click", () => {
    limparSessao();
    renderizarLogin();
  });

  const editor = document.getElementById("editor-sql") as HTMLTextAreaElement;
  const areaResultado = document.getElementById("area-resultado")!;
  const areaMensagem = document.getElementById("area-mensagem")!;
  const botaoTestar = document.getElementById("botao-testar") as HTMLButtonElement;
  const botaoEnviar = document.getElementById("botao-enviar") as HTMLButtonElement;
  const honeypot = document.getElementById("input-site-2") as HTMLInputElement;

  let ultimoResultado: ResultadoVerificacao | undefined;

  if (pgliteEstaIndisponivel()) {
    botaoTestar.disabled = true;
    areaMensagem.innerHTML = `<div class="aviso-caixa">Não foi possível carregar o testador SQL nesta rede. Você ainda pode clicar em "Enviar".</div>`;
  }

  botaoTestar.addEventListener("click", async () => {
    const sql = editor.value;
    botaoTestar.disabled = true;
    const textoOriginal = botaoTestar.textContent;
    botaoTestar.textContent = "Testando…";
    try {
      ultimoResultado = await testarScript(tema, sql);
      areaResultado.innerHTML = renderizarResultadoVerificacao(ultimoResultado);
      areaMensagem.innerHTML = "";
    } catch (e) {
      botaoTestar.disabled = true;
      areaMensagem.innerHTML = `<div class="aviso-caixa">Não foi possível carregar o testador SQL nesta rede. Você ainda pode clicar em "Enviar".</div>`;
    } finally {
      if (!pgliteEstaIndisponivel()) {
        botaoTestar.disabled = false;
        botaoTestar.textContent = textoOriginal;
      }
    }
  });

  botaoEnviar.addEventListener("click", async () => {
    const sessaoAgora = sessaoAtual();
    if (!sessaoAgora) {
      renderizarLogin();
      return;
    }
    botaoEnviar.disabled = true;
    const textoOriginal = botaoEnviar.textContent;
    botaoEnviar.textContent = "Enviando…";
    try {
      const resposta = await enviarScript({
        token: sessaoAgora.token,
        sql: editor.value,
        testeOk: ultimoResultado?.ok,
        testeMensagem: ultimoResultado ? resumoResultado(ultimoResultado) : undefined,
        honeypot: honeypot.value,
      });
      const hora = new Date(resposta.enviadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      areaMensagem.innerHTML = `<div class="mensagem-sucesso">Enviado às ${hora}.</div>`;
    } catch (e) {
      areaMensagem.innerHTML = `<div class="mensagem-erro">${(e as Error).message}</div>`;
    } finally {
      botaoEnviar.disabled = false;
      botaoEnviar.textContent = textoOriginal;
    }
  });
}

function resumoResultado(resultado: ResultadoVerificacao): string {
  if (resultado.ok) return "Passou em todos os itens da checklist.";
  const faltando = resultado.checklist.filter((i) => !i.ok).map((i) => i.rotulo);
  return `Itens pendentes: ${faltando.join("; ")}.`;
}

if (sessaoAtual()) {
  renderizarTelaAluno();
} else {
  renderizarLogin();
}

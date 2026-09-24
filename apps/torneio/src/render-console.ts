import type { PGlite } from "@electric-sql/pglite";
import { EQUIPES, consultaExibicaoTema, rotuloEquipe, type NomeEquipe, type Tema } from "../../../shared/themes";
import { processarEntrada, distribuirNovasLinhas, cadastrarItemRapido, type LinhaSaida } from "./console-controller";
import { definirEsquemaAtivo } from "./db";
import { equipesComItem, type EstadoTorneio } from "./state";
import { extrairImagemDoColar, obterImagem, prepararImagemColada, removerImagem, salvarImagem } from "./imagens";

interface EstadoConsoleTema {
  linhas: LinhaSaida[];
  historico: string[];
  indiceHistorico: number;
  buffer: string;
}

const estadosConsole = new Map<string, EstadoConsoleTema>();
/** Imagem colada mas ainda não salva (item novo, que ainda não tem idFilha), por tema. */
const imagensPendentes = new Map<string, string>();

function obterEstadoConsole(temaId: string): EstadoConsoleTema {
  if (!estadosConsole.has(temaId)) {
    estadosConsole.set(temaId, { linhas: [], historico: [], indiceHistorico: 0, buffer: "" });
  }
  return estadosConsole.get(temaId)!;
}

/** Limpa o histórico/scrollback em memória de todos os consoles (usado em reset/importação). */
export function limparEstadosConsole(): void {
  estadosConsole.clear();
  imagensPendentes.clear();
}

export interface ContextoConsole {
  tema: Tema;
  db: PGlite;
  estado: EstadoTorneio;
  aoMudarEstado: () => void;
  aoIniciarMataMata: () => void;
}

async function itensAtuais(ctx: ContextoConsole): Promise<Map<number, { item: string; relacionado: string }>> {
  await definirEsquemaAtivo(ctx.db, ctx.tema);
  const r = await ctx.db.query<{ id: number; item: string; relacionado: string }>(consultaExibicaoTema(ctx.tema));
  const mapa = new Map<number, { item: string; relacionado: string }>();
  for (const linha of r.rows) mapa.set(linha.id, { item: linha.item, relacionado: linha.relacionado });
  return mapa;
}

/** Remove da atribuição as equipes cujo item foi apagado do banco. Retorna true se algo mudou. */
function reconciliarAtribuicoes(ctx: ContextoConsole, itens: Map<number, unknown>): boolean {
  const atual = ctx.estado.atribuicoes[ctx.tema.id];
  let mudou = false;
  for (const idStr of Object.keys(atual)) {
    const id = Number(idStr);
    if (!itens.has(id)) {
      delete atual[id];
      mudou = true;
    }
  }
  return mudou;
}

export async function renderizarConsole(container: HTMLElement, ctx: ContextoConsole): Promise<void> {
  const estadoConsole = obterEstadoConsole(ctx.tema.id);
  const itens = await itensAtuais(ctx);
  if (reconciliarAtribuicoes(ctx, itens)) ctx.aoMudarEstado();

  const atribuicoes = ctx.estado.atribuicoes[ctx.tema.id];
  const vagasPreenchidas = Object.keys(atribuicoes).length;

  const vagasHtml = EQUIPES.map((equipe) => {
    const idFilha = Object.entries(atribuicoes).find(([, e]) => e === equipe)?.[0];
    const info = idFilha ? itens.get(Number(idFilha)) : undefined;
    const imagem = idFilha ? obterImagem(ctx.tema.id, Number(idFilha)) : null;
    const miniatura = imagem ? `<img class="vaga-miniatura" src="${imagem}" alt="" />` : "";
    return `<div class="vaga">
      ${miniatura}
      <div class="vaga-marca ${info ? "ok" : "vazio"}">${info ? "✓" : "—"}</div>
      <div class="vaga-texto">
        <div class="vaga-equipe">${rotuloEquipe(equipe)}</div>
        ${info ? `<div class="vaga-item">${info.item} (${info.relacionado})</div>` : `<div class="vaga-item">vazio</div>`}
      </div>
    </div>`;
  }).join("");

  const prompt = estadoConsole.buffer === "" ? `${ctx.tema.id}=#` : `${ctx.tema.id}-#`;

  container.innerHTML = `
    <div class="linha-acoes">
      <label for="select-equipe-ativa">Equipe que está indicando:</label>
      <select id="select-equipe-ativa">
        ${EQUIPES.map((e) => `<option value="${e}" ${e === ctx.estado.equipeAtiva ? "selected" : ""}>${rotuloEquipe(e)}</option>`).join("")}
      </select>
      <button data-action="iniciar-mata-mata" class="primario" ${vagasPreenchidas === 8 ? "" : "disabled"}>
        Iniciar mata-mata (${vagasPreenchidas}/8)
      </button>
    </div>
    ${cadastroRapidoHtml(ctx)}
    <div class="layout-console">
      <div class="console">
        <div class="console-saida" id="console-saida">${estadoConsole.linhas
          .map((l) => `<div class="console-linha-${l.tipo === "erro" ? "erro" : l.tipo === "info" ? "info" : ""}">${escaparHtml(l.texto)}</div>`)
          .join("")}</div>
        <div class="console-entrada">
          <span class="console-prompt">${prompt}</span>
          <input id="console-input" type="text" autocomplete="off" spellcheck="false" />
        </div>
      </div>
      <div class="painel-lateral">
        <h2>Vagas do tema (${vagasPreenchidas}/8)</h2>
        ${vagasHtml}
      </div>
    </div>
  `;

  const saidaEl = container.querySelector<HTMLDivElement>("#console-saida")!;
  saidaEl.scrollTop = saidaEl.scrollHeight;

  container.querySelector<HTMLSelectElement>("#select-equipe-ativa")!.addEventListener("change", async (ev) => {
    ctx.estado.equipeAtiva = (ev.target as HTMLSelectElement).value as NomeEquipe;
    ctx.aoMudarEstado();
    // imagem colada mas ainda não cadastrada era pra essa outra equipe: descarta, senão vaza pra próxima
    imagensPendentes.delete(ctx.tema.id);
    // o cadastro rápido depende da equipe ativa (item já existente? imagem de quem?), tem que refazer o painel
    await renderizarConsole(container, ctx);
  });

  container.querySelector("[data-action='iniciar-mata-mata']")?.addEventListener("click", ctx.aoIniciarMataMata);

  ligarCadastroRapido(container, ctx);

  const inputEl = container.querySelector<HTMLInputElement>("#console-input")!;
  inputEl.focus();

  inputEl.addEventListener("keydown", async (ev) => {
    if (ev.key === "ArrowUp") {
      ev.preventDefault();
      if (estadoConsole.indiceHistorico > 0) {
        estadoConsole.indiceHistorico--;
        inputEl.value = estadoConsole.historico[estadoConsole.indiceHistorico] ?? "";
      }
      return;
    }
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      if (estadoConsole.indiceHistorico < estadoConsole.historico.length) {
        estadoConsole.indiceHistorico++;
        inputEl.value = estadoConsole.historico[estadoConsole.indiceHistorico] ?? "";
      }
      return;
    }
    if (ev.key !== "Enter") return;

    const entrada = inputEl.value;
    inputEl.value = "";
    if (entrada.trim() !== "") {
      estadoConsole.historico.push(entrada);
      estadoConsole.indiceHistorico = estadoConsole.historico.length;
    }

    const promptAtual = estadoConsole.buffer === "" ? `${ctx.tema.id}=#` : `${ctx.tema.id}-#`;
    estadoConsole.linhas.push({ tipo: "comando", texto: `${promptAtual} ${entrada}` });

    if (entrada.trim() === "clear") {
      estadoConsole.linhas = [];
      estadoConsole.buffer = "";
      await renderizarConsole(container, ctx);
      return;
    }

    const resultado = await processarEntrada({ db: ctx.db, tema: ctx.tema, bufferAtual: estadoConsole.buffer, entrada });
    estadoConsole.linhas.push(...resultado.linhas);
    estadoConsole.buffer = resultado.restoBuffer;

    if (resultado.novasLinhasFilha.length > 0) {
      await atribuirNovasLinhas(ctx, resultado.novasLinhasFilha, estadoConsole);
    }

    await renderizarConsole(container, ctx);
  });
}

async function atribuirNovasLinhas(
  ctx: ContextoConsole,
  novas: { idFilha: number; item: string }[],
  estadoConsole: EstadoConsoleTema,
): Promise<void> {
  const atribuicoes = ctx.estado.atribuicoes[ctx.tema.id];
  const jaAtribuidas = equipesComItem(ctx.estado, ctx.tema.id);

  if (novas.length === 1) {
    if (jaAtribuidas.has(ctx.estado.equipeAtiva)) {
      estadoConsole.linhas.push({
        tipo: "info",
        texto: `Aviso: a equipe "${rotuloEquipe(ctx.estado.equipeAtiva)}" já tem um item neste tema. A linha foi inserida, mas não foi atribuída.`,
      });
      return;
    }
    atribuicoes[novas[0].idFilha] = ctx.estado.equipeAtiva;
    ctx.aoMudarEstado();
    return;
  }

  const distribuicao = distribuirNovasLinhas(novas, jaAtribuidas);
  if (distribuicao.length === 0) {
    estadoConsole.linhas.push({ tipo: "info", texto: "Aviso: todas as equipes já têm item neste tema; nenhuma linha nova foi atribuída." });
    return;
  }
  const previa = distribuicao.map((d) => `${rotuloEquipe(d.equipe)} -> ${d.item}`).join("\n");
  const confirmar = window.confirm(`Atribuir as novas linhas assim?\n\n${previa}`);
  if (!confirmar) {
    estadoConsole.linhas.push({ tipo: "info", texto: "Atribuição cancelada. As linhas foram inseridas, mas nenhuma equipe foi associada." });
    return;
  }
  for (const d of distribuicao) atribuicoes[d.idFilha] = d.equipe;
  ctx.aoMudarEstado();
}

function idFilhaDaEquipeAtiva(ctx: ContextoConsole): number | null {
  const atribuicoes = ctx.estado.atribuicoes[ctx.tema.id];
  const par = Object.entries(atribuicoes).find(([, equipe]) => equipe === ctx.estado.equipeAtiva);
  return par ? Number(par[0]) : null;
}

function zonaColarImagemHtml(imagemAtual: string | null): string {
  const temImagem = !!imagemAtual;
  return `
    <div class="zona-colar-imagem" id="zona-colar-imagem" tabindex="0">
      <div id="dica-colar-imagem" style="${temImagem ? "display:none" : ""}">
        Clique aqui e cole (Ctrl+V) uma imagem para identificar o item
      </div>
      <img id="preview-imagem" src="${imagemAtual ?? ""}" style="${temImagem ? "" : "display:none"}" alt="" />
      <button id="botao-remover-imagem" type="button" style="${temImagem ? "" : "display:none"}">Remover imagem</button>
    </div>`;
}

function cadastroRapidoHtml(ctx: ContextoConsole): string {
  const idFilhaExistente = idFilhaDaEquipeAtiva(ctx);
  const tema = ctx.tema;

  if (idFilhaExistente !== null) {
    const imagemAtual = obterImagem(tema.id, idFilhaExistente);
    return `<div class="cadastro-rapido">
      <h2>Cadastro rápido</h2>
      <p class="rotulo-pequeno">A equipe "${rotuloEquipe(ctx.estado.equipeAtiva)}" já tem item neste tema. Você ainda pode anexar/trocar a imagem dela.</p>
      <div class="cadastro-rapido-linha">
        ${zonaColarImagemHtml(imagemAtual)}
      </div>
    </div>`;
  }

  const imagemPendente = imagensPendentes.get(tema.id) ?? null;

  return `<div class="cadastro-rapido">
    <h2>Cadastro rápido — ${rotuloEquipe(ctx.estado.equipeAtiva)}</h2>
    <div class="cadastro-rapido-linha">
      <div class="template-comando">
        <div class="linha-template">INSERT INTO ${tema.tabelaPai} (nome) VALUES ('<input id="input-relacionado" class="valor-inline" placeholder="${tema.exemploPai}" autocomplete="off" />');</div>
        <div class="linha-template">INSERT INTO ${tema.tabelaFilha} (${tema.colunaItem}, id_${tema.tabelaPai}) VALUES ('<input id="input-item" class="valor-inline" placeholder="${tema.exemploItem}" autocomplete="off" />', id_gerado);</div>
        <div class="linha-acoes">
          <button data-action="cadastrar-rapido" class="primario">Cadastrar item</button>
        </div>
        <p class="rotulo-pequeno">Se o nome do "pai" já existir neste tema (ex.: duas bandas do mesmo país), a linha existente é reaproveitada em vez de duplicada.</p>
      </div>
      ${zonaColarImagemHtml(imagemPendente)}
    </div>
  </div>`;
}

function ligarCadastroRapido(container: HTMLElement, ctx: ContextoConsole): void {
  const idFilhaExistente = idFilhaDaEquipeAtiva(ctx);
  const zona = container.querySelector<HTMLDivElement>("#zona-colar-imagem");
  const preview = container.querySelector<HTMLImageElement>("#preview-imagem");
  const dica = container.querySelector<HTMLDivElement>("#dica-colar-imagem");
  const botaoRemover = container.querySelector<HTMLButtonElement>("#botao-remover-imagem");

  zona?.addEventListener("paste", async (ev) => {
    const arquivo = extrairImagemDoColar(ev);
    if (!arquivo) return;
    ev.preventDefault();
    const dataUrl = await prepararImagemColada(arquivo);
    if (idFilhaExistente !== null) {
      salvarImagem(ctx.tema.id, idFilhaExistente, dataUrl);
      // a miniatura no painel de vagas também precisa aparecer, não só a prévia do formulário
      await renderizarConsole(container, ctx);
      return;
    }
    imagensPendentes.set(ctx.tema.id, dataUrl);
    if (preview) {
      preview.src = dataUrl;
      preview.style.display = "";
    }
    if (dica) dica.style.display = "none";
    if (botaoRemover) botaoRemover.style.display = "";
  });

  botaoRemover?.addEventListener("click", async () => {
    if (idFilhaExistente !== null) {
      removerImagem(ctx.tema.id, idFilhaExistente);
      await renderizarConsole(container, ctx);
      return;
    }
    imagensPendentes.delete(ctx.tema.id);
    if (preview) preview.style.display = "none";
    if (dica) dica.style.display = "";
    if (botaoRemover) botaoRemover.style.display = "none";
  });

  const botaoCadastrar = container.querySelector<HTMLButtonElement>("[data-action='cadastrar-rapido']");
  botaoCadastrar?.addEventListener("click", async () => {
    const inputRelacionado = container.querySelector<HTMLInputElement>("#input-relacionado")!;
    const inputItem = container.querySelector<HTMLInputElement>("#input-item")!;
    const relacionado = inputRelacionado.value.trim();
    const item = inputItem.value.trim();
    if (!relacionado || !item) {
      alert("Preencha os dois campos antes de cadastrar.");
      return;
    }
    if (equipesComItem(ctx.estado, ctx.tema.id).has(ctx.estado.equipeAtiva)) {
      alert(`A equipe "${rotuloEquipe(ctx.estado.equipeAtiva)}" já tem um item neste tema.`);
      return;
    }

    botaoCadastrar.disabled = true;
    try {
      const resultado = await cadastrarItemRapido({ db: ctx.db, tema: ctx.tema, relacionado, item });
      const estadoConsole = obterEstadoConsole(ctx.tema.id);
      estadoConsole.linhas.push(...resultado.linhas);

      ctx.estado.atribuicoes[ctx.tema.id][resultado.idFilha] = ctx.estado.equipeAtiva;

      const imagemPendente = imagensPendentes.get(ctx.tema.id);
      if (imagemPendente) {
        salvarImagem(ctx.tema.id, resultado.idFilha, imagemPendente);
        imagensPendentes.delete(ctx.tema.id);
      }

      ctx.aoMudarEstado();
      await renderizarConsole(container, ctx);
    } finally {
      botaoCadastrar.disabled = false;
    }
  });
}

function escaparHtml(texto: string): string {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

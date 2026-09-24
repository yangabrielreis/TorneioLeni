import "./style.css";
import { TEMAS, consultaExibicaoTema, type Tema } from "../../../shared/themes";
import { obterBanco, apagarBanco, definirEsquemaAtivo } from "./db";
import { carregarEstado, salvarEstado, estadoInicial, limparEstado, todosTemasComCampeao, type EstadoTorneio } from "./state";
import { renderizarConsole, limparEstadosConsole, type ContextoConsole } from "./render-console";
import { renderizarChaveamento, renderizarProjetor, type ContextoChaveamento } from "./render-bracket";
import { preencherModoDemonstracao } from "./demo";
import { exportarBackup, importarBackup, baixarBackupComoArquivo, type BackupJSON } from "./backup";
import type { Participante, Chaveamento } from "./bracket";
import { obterImagem, limparTodasImagens } from "./imagens";
import { renderizarRanking, reiniciarRevelacaoRanking } from "./render-ranking";

const FINAL_GERAL_ID = "__final__";

let estado: EstadoTorneio = carregarEstado();
let tela: "console" | "mata-mata" | "projetor" | "ranking" = "console";
let temaAtivoId: string = TEMAS[0].id;

const app = document.getElementById("app")!;

function persistir(): void {
  salvarEstado(estado);
}

async function participantesDoTema(tema: Tema, db: Awaited<ReturnType<typeof obterBanco>>): Promise<Participante[] | null> {
  const atribuicoes = estado.atribuicoes[tema.id];
  if (Object.keys(atribuicoes).length !== 8) return null;
  await definirEsquemaAtivo(db, tema);
  const r = await db.query<{ id: number; item: string; relacionado: string }>(consultaExibicaoTema(tema));
  const porId = new Map(r.rows.map((row) => [row.id, row]));
  const participantes: Participante[] = [];
  for (const [idStr, equipe] of Object.entries(atribuicoes)) {
    const info = porId.get(Number(idStr));
    if (!info) return null;
    const imagemUrl = obterImagem(tema.id, Number(idStr)) ?? undefined;
    participantes.push({ chave: equipe, item: info.item, relacionado: info.relacionado, equipe, imagemUrl });
  }
  return participantes;
}

function participantesDaFinal(): Participante[] | null {
  if (!todosTemasComCampeao(estado)) return null;
  return TEMAS.map((tema) => {
    const campeao = estado.chaveamentos[tema.id]!.campeao!;
    return { chave: tema.id, item: campeao.item, relacionado: tema.nome, equipe: campeao.equipe, imagemUrl: campeao.imagemUrl };
  });
}

function construirCtxChaveamento(db: Awaited<ReturnType<typeof obterBanco>>): { tema: Tema | null; ctx: ContextoChaveamento } {
  const ehFinal = temaAtivoId === FINAL_GERAL_ID;
  const tema = ehFinal ? null : TEMAS.find((t) => t.id === temaAtivoId)!;

  const ctx: ContextoChaveamento = {
    titulo: ehFinal ? "Final geral — o melhor de todos" : `Mata-mata — ${tema!.nome}`,
    obterParticipantesProntos: () => null, // preenchido de forma assíncrona antes de renderizar (ver abaixo)
    obterChaveamento: () => (ehFinal ? estado.finalGeral : estado.chaveamentos[tema!.id]),
    definirChaveamento: (c) => {
      if (ehFinal) estado.finalGeral = c;
      else estado.chaveamentos[tema!.id] = c as Chaveamento;
      persistir();
      atualizarHabilitacaoFinal();
    },
    mostrarEquipe: () => estado.mostrarEquipeNoConfronto,
    aoAlternarMostrarEquipe: () => {
      estado.mostrarEquipeNoConfronto = !estado.mostrarEquipeNoConfronto;
      persistir();
    },
  };
  return { tema, ctx };
}

function atualizarHabilitacaoFinal(): void {
  const botaoFinal = document.querySelector<HTMLButtonElement>("[data-tema-tab='" + FINAL_GERAL_ID + "']");
  if (botaoFinal) botaoFinal.disabled = !todosTemasComCampeao(estado);
}

async function renderizarTopo(): Promise<void> {
  const topo = document.createElement("div");
  topo.className = "topo";
  topo.innerHTML = `
    <h1>Torneio de Banco de Dados</h1>
    <div class="nav-abas">
      <button data-nav="console" class="${tela === "console" ? "ativo" : ""}">Console</button>
      <button data-nav="mata-mata" class="${tela === "mata-mata" || tela === "projetor" ? "ativo" : ""}">Mata-mata</button>
      <button data-nav="ranking" class="${tela === "ranking" ? "ativo" : ""}">Ranking</button>
    </div>
    <div class="nav-abas">
      <button data-action="demo">Modo demonstração</button>
      <button data-action="exportar">Exportar backup</button>
      <button data-action="importar">Importar backup</button>
      <button data-action="reiniciar" class="perigo">Reiniciar tudo</button>
    </div>
    <input type="file" id="input-importar" accept="application/json" style="display:none" />
  `;
  app.appendChild(topo);

  topo.querySelector("[data-nav='console']")!.addEventListener("click", () => {
    tela = "console";
    renderizarApp();
  });
  topo.querySelector("[data-nav='mata-mata']")!.addEventListener("click", () => {
    tela = "mata-mata";
    renderizarApp();
  });
  topo.querySelector("[data-nav='ranking']")!.addEventListener("click", () => {
    tela = "ranking";
    renderizarApp();
  });

  const botaoDemo = topo.querySelector<HTMLButtonElement>("[data-action='demo']")!;
  botaoDemo.addEventListener("click", async () => {
    if (!confirm("Preencher as vagas ainda vazias com dados fictícios (Exemplo N / Item N)?")) return;
    botaoDemo.disabled = true;
    const textoOriginal = botaoDemo.textContent;
    botaoDemo.textContent = "Preenchendo…";
    try {
      estado.atribuicoes = await preencherModoDemonstracao(estado);
      persistir();
    } finally {
      botaoDemo.disabled = false;
      botaoDemo.textContent = textoOriginal;
    }
    renderizarApp();
  });

  topo.querySelector("[data-action='exportar']")!.addEventListener("click", async () => {
    const backup = await exportarBackup(estado);
    baixarBackupComoArquivo(backup);
  });

  const inputImportar = topo.querySelector<HTMLInputElement>("#input-importar")!;
  topo.querySelector("[data-action='importar']")!.addEventListener("click", () => inputImportar.click());
  inputImportar.addEventListener("change", async () => {
    const arquivo = inputImportar.files?.[0];
    if (!arquivo) return;
    if (!confirm("Importar este backup vai substituir todos os dados atuais. Continuar?")) {
      inputImportar.value = "";
      return;
    }
    try {
      const texto = await arquivo.text();
      const backup = JSON.parse(texto) as BackupJSON;
      estado = await importarBackup(backup);
      limparEstadosConsole();
      reiniciarRevelacaoRanking();
      tela = "console";
      renderizarApp();
    } catch (e) {
      alert("Não foi possível importar este arquivo. Confira se é um backup válido do torneio.");
    } finally {
      inputImportar.value = "";
    }
  });

  topo.querySelector("[data-action='reiniciar']")!.addEventListener("click", async () => {
    if (!confirm("Isso vai apagar TODOS os itens cadastrados e o mata-mata. Não pode ser desfeito. Continuar?")) return;
    await apagarBanco();
    limparEstado();
    limparTodasImagens();
    estado = estadoInicial();
    limparEstadosConsole();
    reiniciarRevelacaoRanking();
    tela = "console";
    renderizarApp();
  });
}

function renderizarAbasTemas(nav: HTMLElement, incluirFinal: boolean): void {
  nav.className = "temas-abas";
  nav.innerHTML =
    TEMAS.map((t) => `<button data-tema-tab="${t.id}" class="${temaAtivoId === t.id ? "ativo" : ""}">${t.nome}</button>`).join("") +
    (incluirFinal
      ? `<button data-tema-tab="${FINAL_GERAL_ID}" class="${temaAtivoId === FINAL_GERAL_ID ? "ativo" : ""}" ${
          todosTemasComCampeao(estado) ? "" : "disabled"
        }>Final geral</button>`
      : "");
  nav.querySelectorAll<HTMLButtonElement>("[data-tema-tab]").forEach((botao) => {
    botao.addEventListener("click", () => {
      temaAtivoId = botao.dataset.temaTab!;
      renderizarApp();
    });
  });
}

async function renderizarApp(): Promise<void> {
  app.innerHTML = "";
  await renderizarTopo();

  const conteudo = document.createElement("div");
  conteudo.className = "conteudo";
  app.appendChild(conteudo);

  const db = await obterBanco();

  if (tela === "projetor") {
    const { ctx } = construirCtxChaveamento(db);
    renderizarProjetor(
      conteudo,
      ctx,
      () => {
        tela = "mata-mata";
        renderizarApp();
      },
      () => {
        /* a barra superior não depende do confronto atual; nada a fazer aqui */
      },
    );
    return;
  }

  if (tela === "ranking") {
    renderizarRanking(conteudo, estado);
    return;
  }

  const navTemas = document.createElement("div");
  conteudo.appendChild(navTemas);
  const areaTela = document.createElement("div");
  conteudo.appendChild(areaTela);

  if (tela === "console") {
    if (!TEMAS.some((t) => t.id === temaAtivoId)) temaAtivoId = TEMAS[0].id;
    renderizarAbasTemas(navTemas, false);
    const tema = TEMAS.find((t) => t.id === temaAtivoId)!;
    const ctxConsole: ContextoConsole = {
      tema,
      db,
      estado,
      aoMudarEstado: persistir,
      aoIniciarMataMata: () => {
        tela = "mata-mata";
        renderizarApp();
      },
    };
    await renderizarConsole(areaTela, ctxConsole);
  } else {
    renderizarAbasTemas(navTemas, true);
    const { tema, ctx } = construirCtxChaveamento(db);
    const participantes = tema ? await participantesDoTema(tema, db) : participantesDaFinal();
    ctx.obterParticipantesProntos = () => participantes;
    renderizarChaveamento(areaTela, ctx, () => {
      tela = "projetor";
      renderizarApp();
    });
  }
}

renderizarApp();

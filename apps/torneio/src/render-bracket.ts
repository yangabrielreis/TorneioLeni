import {
  chaveamentoCompleto,
  confrontoEstaProntoParaDecisao,
  decidirVencedor,
  desfazerUltimaDecisao,
  incrementarVoto,
  podeSortearNovamente,
  sortearChaveamento,
  vencedorPorVotos,
  type Chaveamento,
  type Confronto,
  type Participante,
} from "./bracket";
import { rotuloItem, rotuloEquipe, type NomeEquipe } from "../../../shared/themes";

export interface ContextoChaveamento {
  titulo: string;
  /** null enquanto não houver 8 participantes prontos (8 vagas do tema, ou 8 campeões) */
  obterParticipantesProntos: () => Participante[] | null;
  obterChaveamento: () => Chaveamento | undefined;
  definirChaveamento: (c: Chaveamento | undefined) => void;
  /** função (não valor fixo) pra sempre ler o estado atual, mesmo em re-renders internos após alternar */
  mostrarEquipe: () => boolean;
  aoAlternarMostrarEquipe: () => void;
  aoCampeaoDefinido?: (campeao: Participante) => void;
}

const NOMES_RODADA: Record<Confronto["rodada"], string> = {
  quartas: "Quartas de final",
  semis: "Semifinais",
  final: "Final",
};

function imagemHtml(p: Participante, classe: string): string {
  return p.imagemUrl ? `<img class="${classe}" src="${p.imagemUrl}" alt="" />` : "";
}

function controleVotosHtml(confronto: Confronto, ladoId: "a" | "b", pronto: boolean, decidido: boolean): string {
  const campo = ladoId === "a" ? confronto.votosA : confronto.votosB;
  const votos = campo ?? 0;
  if (pronto && !decidido) {
    return `<div class="controle-votos">
      <button data-action="voto-menos" data-confronto="${confronto.id}" data-lado="${ladoId}" ${votos === 0 ? "disabled" : ""}>−1</button>
      <span class="contagem-votos">${votos} voto${votos === 1 ? "" : "s"}</span>
      <button data-action="voto-mais" data-confronto="${confronto.id}" data-lado="${ladoId}">+1 voto</button>
    </div>`;
  }
  if (campo !== undefined) {
    return `<div class="contagem-votos">${votos} voto${votos === 1 ? "" : "s"}</div>`;
  }
  return "";
}

function cartaoConfronto(confronto: Confronto, ctx: ContextoChaveamento): string {
  const decidido = !!confronto.vencedor;
  const pronto = confrontoEstaProntoParaDecisao(confronto);
  const lado = (p: Participante | undefined, ladoId: "a" | "b") => {
    if (!p) return `<div class="confronto-lado">— aguardando —</div>`;
    const venceu = confronto.vencedor?.chave === p.chave;
    const equipeInfo = ctx.mostrarEquipe() ? `<div class="confronto-lado-equipe">${p.equipe}</div>` : "";
    const botao =
      pronto && !decidido
        ? `<button data-action="decidir" data-confronto="${confronto.id}" data-lado="${ladoId}">Vencedor</button>`
        : "";
    return `<div class="confronto-lado ${venceu ? "vencedor" : ""}">
      ${imagemHtml(p, "miniatura-item")}
      <div class="confronto-lado-corpo">
        <div class="confronto-lado-texto">${rotuloItem(p.item, p.relacionado)}</div>
        ${equipeInfo}
        ${controleVotosHtml(confronto, ladoId, pronto, decidido)}
      </div>
      ${botao}
    </div>`;
  };

  const naoVotam =
    ctx.mostrarEquipe() && confronto.a && confronto.b
      ? `<div class="aviso-nao-votam">Não votam neste confronto: ${confronto.a.equipe} e ${confronto.b.equipe}</div>`
      : "";

  const botaoDecidirPelosVotos =
    pronto && !decidido
      ? `<div class="linha-acoes"><button data-action="decidir-por-votos" data-confronto="${confronto.id}">Definir vencedor pelos votos</button></div>`
      : "";

  return `<div class="confronto-card ${decidido ? "decidido" : ""}">
    ${lado(confronto.a, "a")}
    <div class="confronto-vs">vs</div>
    ${lado(confronto.b, "b")}
    ${naoVotam}
    ${botaoDecidirPelosVotos}
  </div>`;
}

function aplicarDecisaoPorVotos(ch: Chaveamento, confronto: Confronto, ctx: ContextoChaveamento): boolean {
  const votosA = confronto.votosA ?? 0;
  const votosB = confronto.votosB ?? 0;
  const lado = vencedorPorVotos(votosA, votosB);
  if (!lado) {
    alert("Empate! Escolha o vencedor manualmente (sugestão: a equipe dona do tema desempata).");
    return false;
  }
  const participante = lado === "a" ? confronto.a : confronto.b;
  if (!participante) return false;
  decidirVencedor(ch, confronto.id, participante.chave);
  ctx.definirChaveamento(ch);
  if (chaveamentoCompleto(ch) && ctx.aoCampeaoDefinido) ctx.aoCampeaoDefinido(ch.campeao!);
  return true;
}

export function renderizarChaveamento(container: HTMLElement, ctx: ContextoChaveamento, irParaProjetor: () => void): void {
  const chaveamento = ctx.obterChaveamento();
  const participantesProntos = ctx.obterParticipantesProntos();

  const acoes: string[] = [];
  if (!chaveamento) {
    acoes.push(
      `<button class="primario" data-action="sortear" ${participantesProntos ? "" : "disabled"}>Sortear chaveamento</button>`,
    );
    if (!participantesProntos) {
      acoes.push(`<span class="rotulo-pequeno">Preencha as 8 vagas para liberar o sorteio.</span>`);
    }
  } else {
    if (podeSortearNovamente(chaveamento)) {
      acoes.push(`<button data-action="sortear-de-novo">Sortear de novo</button>`);
    }
    acoes.push(`<button data-action="alternar-mostrar-equipe">${ctx.mostrarEquipe() ? "Ocultar equipe" : "Mostrar equipe"}</button>`);
    acoes.push(`<button data-action="desfazer" ${chaveamento.decisoes.length ? "" : "disabled"}>Desfazer última decisão</button>`);
    acoes.push(`<button data-action="ir-projetor">Modo projetor (tela cheia)</button>`);
  }

  let corpo = "";
  if (chaveamento) {
    if (chaveamentoCompleto(chaveamento)) {
      corpo = `<div class="caixa">
        ${imagemHtml(chaveamento.campeao!, "miniatura-campeao")}
        <div class="rotulo-pequeno">Campeão</div>
        <div class="campeao">${rotuloItem(chaveamento.campeao!.item, chaveamento.campeao!.relacionado)}</div>
        ${ctx.mostrarEquipe() ? `<div class="campeao-equipe">${rotuloEquipe(chaveamento.campeao!.equipe as NomeEquipe)}</div>` : ""}
      </div>`;
    } else {
      const rodadas: Confronto["rodada"][] = ["quartas", "semis", "final"];
      corpo = rodadas
        .map((rodada) => {
          const confrontos = chaveamento.confrontos.filter((c) => c.rodada === rodada);
          return `<div class="chaveamento-rodada">
            <h3>${NOMES_RODADA[rodada]}</h3>
            <div class="confrontos-grid">${confrontos.map((c) => cartaoConfronto(c, ctx)).join("")}</div>
          </div>`;
        })
        .join("");
    }
  } else {
    corpo = `<p class="rotulo-pequeno">Nenhum chaveamento sorteado ainda.</p>`;
  }

  container.innerHTML = `<h2>${ctx.titulo}</h2>
    <div class="linha-acoes">${acoes.join("")}</div>
    ${corpo}`;

  container.querySelectorAll<HTMLButtonElement>("[data-action='decidir']").forEach((botao) => {
    botao.addEventListener("click", () => {
      const ch = ctx.obterChaveamento();
      if (!ch) return;
      const confrontoId = botao.dataset.confronto!;
      const ladoId = botao.dataset.lado as "a" | "b";
      const confronto = ch.confrontos.find((c) => c.id === confrontoId)!;
      const participante = ladoId === "a" ? confronto.a : confronto.b;
      if (!participante) return;
      decidirVencedor(ch, confrontoId, participante.chave);
      ctx.definirChaveamento(ch);
      if (chaveamentoCompleto(ch) && ctx.aoCampeaoDefinido) ctx.aoCampeaoDefinido(ch.campeao!);
      renderizarChaveamento(container, ctx, irParaProjetor);
    });
  });

  container.querySelectorAll<HTMLButtonElement>("[data-action='voto-mais'], [data-action='voto-menos']").forEach((botao) => {
    botao.addEventListener("click", () => {
      const ch = ctx.obterChaveamento();
      if (!ch) return;
      const confrontoId = botao.dataset.confronto!;
      const ladoId = botao.dataset.lado as "a" | "b";
      const delta = botao.dataset.action === "voto-mais" ? 1 : -1;
      incrementarVoto(ch, confrontoId, ladoId, delta);
      ctx.definirChaveamento(ch);
      renderizarChaveamento(container, ctx, irParaProjetor);
    });
  });

  container.querySelectorAll<HTMLButtonElement>("[data-action='decidir-por-votos']").forEach((botao) => {
    botao.addEventListener("click", () => {
      const ch = ctx.obterChaveamento();
      if (!ch) return;
      const confrontoId = botao.dataset.confronto!;
      const confronto = ch.confrontos.find((c) => c.id === confrontoId)!;
      if (aplicarDecisaoPorVotos(ch, confronto, ctx)) {
        renderizarChaveamento(container, ctx, irParaProjetor);
      }
    });
  });

  container.querySelector("[data-action='sortear']")?.addEventListener("click", () => {
    const participantes = ctx.obterParticipantesProntos();
    if (!participantes) return;
    ctx.definirChaveamento(sortearChaveamento(participantes));
    renderizarChaveamento(container, ctx, irParaProjetor);
  });

  container.querySelector("[data-action='sortear-de-novo']")?.addEventListener("click", () => {
    const participantes = ctx.obterParticipantesProntos();
    if (!participantes) return;
    ctx.definirChaveamento(sortearChaveamento(participantes));
    renderizarChaveamento(container, ctx, irParaProjetor);
  });

  container.querySelector("[data-action='desfazer']")?.addEventListener("click", () => {
    const ch = ctx.obterChaveamento();
    if (!ch) return;
    desfazerUltimaDecisao(ch);
    ctx.definirChaveamento(ch);
    renderizarChaveamento(container, ctx, irParaProjetor);
  });

  container.querySelector("[data-action='alternar-mostrar-equipe']")?.addEventListener("click", () => {
    ctx.aoAlternarMostrarEquipe();
    renderizarChaveamento(container, ctx, irParaProjetor);
  });

  container.querySelector("[data-action='ir-projetor']")?.addEventListener("click", irParaProjetor);
}

/** Próximo confronto pronto para decisão, na ordem quartas -> semis -> final. */
export function proximoConfrontoPronto(chaveamento: Chaveamento): Confronto | undefined {
  const ordem = ["q0", "q1", "q2", "q3", "s0", "s1", "f0"];
  for (const id of ordem) {
    const c = chaveamento.confrontos.find((x) => x.id === id)!;
    if (confrontoEstaProntoParaDecisao(c)) return c;
  }
  return undefined;
}

export function renderizarProjetor(
  container: HTMLElement,
  ctx: ContextoChaveamento,
  aoVoltar: () => void,
  rerenderizarPrincipal: () => void,
): void {
  const chaveamento = ctx.obterChaveamento();

  if (!chaveamento) {
    container.innerHTML = `<div class="projetor"><p>Nenhum chaveamento sorteado ainda.</p><button data-action="voltar">Voltar</button></div>`;
    container.querySelector("[data-action='voltar']")?.addEventListener("click", aoVoltar);
    return;
  }

  if (chaveamentoCompleto(chaveamento)) {
    container.innerHTML = `<div class="projetor">
      <h2>${ctx.titulo} — Campeão</h2>
      ${imagemHtml(chaveamento.campeao!, "miniatura-campeao-projetor")}
      <div class="campeao">${rotuloItem(chaveamento.campeao!.item, chaveamento.campeao!.relacionado)}</div>
      ${ctx.mostrarEquipe() ? `<div class="campeao-equipe">${rotuloEquipe(chaveamento.campeao!.equipe as NomeEquipe)}</div>` : ""}
      <button data-action="voltar">Voltar</button>
    </div>`;
    container.querySelector("[data-action='voltar']")?.addEventListener("click", aoVoltar);
    return;
  }

  const confronto = proximoConfrontoPronto(chaveamento);
  if (!confronto) {
    container.innerHTML = `<div class="projetor"><p>Aguardando confrontos anteriores serem decididos.</p><button data-action="voltar">Voltar</button></div>`;
    container.querySelector("[data-action='voltar']")?.addEventListener("click", aoVoltar);
    return;
  }

  const ladoHtml = (p: Participante, ladoId: "a" | "b") => {
    const votos = (ladoId === "a" ? confronto.votosA : confronto.votosB) ?? 0;
    return `
    <div class="projetor-lado">
      ${imagemHtml(p, "miniatura-item-projetor")}
      <div>${rotuloItem(p.item, p.relacionado)}</div>
      ${ctx.mostrarEquipe() ? `<div class="confronto-lado-equipe">${p.equipe}</div>` : ""}
      <div class="controle-votos controle-votos-projetor">
        <button data-action="voto-menos" data-lado="${ladoId}" ${votos === 0 ? "disabled" : ""}>−1</button>
        <span class="contagem-votos-projetor">${votos}</span>
        <button data-action="voto-mais" data-lado="${ladoId}" class="primario">+1 voto</button>
      </div>
      <button data-action="decidir" data-lado="${ladoId}">Vencedor</button>
    </div>`;
  };

  const naoVotam =
    ctx.mostrarEquipe()
      ? `<div class="aviso-nao-votam">Não votam neste confronto: ${confronto.a!.equipe} e ${confronto.b!.equipe}</div>`
      : "";

  container.innerHTML = `<div class="projetor">
    <h2>${ctx.titulo} — ${NOMES_RODADA[confronto.rodada]}</h2>
    <div class="projetor-confronto">
      ${ladoHtml(confronto.a!, "a")}
      <div class="projetor-vs">vs</div>
      ${ladoHtml(confronto.b!, "b")}
    </div>
    ${naoVotam}
    <div class="linha-acoes">
      <button data-action="decidir-por-votos">Definir vencedor pelos votos</button>
      <button data-action="voltar">Voltar</button>
    </div>
  </div>`;

  const rerenderizarProjetor = () => renderizarProjetor(container, ctx, aoVoltar, rerenderizarPrincipal);

  container.querySelectorAll<HTMLButtonElement>("[data-action='decidir']").forEach((botao) => {
    botao.addEventListener("click", () => {
      const ladoId = botao.dataset.lado as "a" | "b";
      const participante = ladoId === "a" ? confronto.a : confronto.b;
      if (!participante) return;
      decidirVencedor(chaveamento, confronto.id, participante.chave);
      ctx.definirChaveamento(chaveamento);
      if (chaveamentoCompleto(chaveamento) && ctx.aoCampeaoDefinido) ctx.aoCampeaoDefinido(chaveamento.campeao!);
      rerenderizarPrincipal();
      rerenderizarProjetor();
    });
  });

  container.querySelectorAll<HTMLButtonElement>("[data-action='voto-mais'], [data-action='voto-menos']").forEach((botao) => {
    botao.addEventListener("click", () => {
      const ladoId = botao.dataset.lado as "a" | "b";
      const delta = botao.dataset.action === "voto-mais" ? 1 : -1;
      incrementarVoto(chaveamento, confronto.id, ladoId, delta);
      ctx.definirChaveamento(chaveamento);
      rerenderizarProjetor();
    });
  });

  container.querySelector("[data-action='decidir-por-votos']")?.addEventListener("click", () => {
    if (aplicarDecisaoPorVotos(chaveamento, confronto, ctx)) {
      rerenderizarPrincipal();
      rerenderizarProjetor();
    }
  });

  container.querySelector("[data-action='voltar']")?.addEventListener("click", aoVoltar);
}

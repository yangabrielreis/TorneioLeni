import { calcularRanking, type LinhaRanking } from "./ranking";
import { rotuloEquipe } from "../../../shared/themes";
import type { EstadoTorneio } from "./state";

/**
 * Quantas colocações já foram reveladas, de trás pra frente:
 * 0 = nada ainda (só o botão "Ver ranking")
 * 1..N-3 = revelando uma a uma, da última colocação até a 4ª
 * N-2 = revelou o pódio (3º, 2º e 1º juntos) — sequência completa
 */
let nivelRevelado = 0;

/** Reinicia a revelação (chamado em "Reiniciar tudo"). */
export function reiniciarRevelacaoRanking(): void {
  nivelRevelado = 0;
}

function linhaAvulsaHtml(posicao: number, linha: LinhaRanking): string {
  return `<div class="ranking-linha-revelada">
    <span class="ranking-posicao">${posicao}º</span>
    <span class="ranking-equipe">${rotuloEquipe(linha.equipe)}</span>
    <span class="ranking-votos">${linha.votos} voto${linha.votos === 1 ? "" : "s"}</span>
  </div>`;
}

function podioHtml(top3: LinhaRanking[]): string {
  // ordem visual clássica: 2º à esquerda, 1º no meio (mais alto), 3º à direita
  const [primeiro, segundo, terceiro] = top3;
  const degrau = (posicao: number, linha: LinhaRanking | undefined, classe: string) =>
    linha
      ? `<div class="podio-lugar ${classe}">
          <div class="podio-nome">${rotuloEquipe(linha.equipe)}</div>
          <div class="podio-votos">${linha.votos} voto${linha.votos === 1 ? "" : "s"}</div>
          <div class="podio-degrau">${posicao}º</div>
        </div>`
      : "";
  return `<div class="podio">
    ${degrau(2, segundo, "podio-2")}
    ${degrau(1, primeiro, "podio-1")}
    ${degrau(3, terceiro, "podio-3")}
  </div>`;
}

export function renderizarRanking(container: HTMLElement, estado: EstadoTorneio): void {
  const linhas = calcularRanking(estado);
  const total = linhas.length;
  const totalPodio = Math.min(3, total);
  const totalAvulsas = Math.max(0, total - totalPodio);

  const cabecalho = `<h2>Ranking geral de votos</h2>
    <p class="rotulo-pequeno">Soma dos votos recebidos pelos itens que cada equipe indicou, em todos os temas e na final geral.</p>`;

  if (nivelRevelado === 0) {
    container.innerHTML = `${cabecalho}
      <div class="ranking-intro">
        <button class="primario" data-action="ver-ranking">Ver ranking</button>
      </div>`;
    container.querySelector("[data-action='ver-ranking']")?.addEventListener("click", () => {
      nivelRevelado = 1;
      renderizarRanking(container, estado);
    });
    return;
  }

  const avulsasReveladas = Math.min(nivelRevelado, totalAvulsas);
  const podioRevelado = nivelRevelado > totalAvulsas;
  const sequenciaCompleta = nivelRevelado >= totalAvulsas + 1;

  const avulsasHtml: string[] = [];
  for (let i = 0; i < avulsasReveladas; i++) {
    const posicao = total - i;
    avulsasHtml.push(linhaAvulsaHtml(posicao, linhas[posicao - 1]));
  }

  const corpoPodio = podioRevelado ? podioHtml(linhas.slice(0, totalPodio)) : "";

  let botaoHtml = "";
  if (!sequenciaCompleta) {
    const proximaEhPodio = avulsasReveladas + 1 > totalAvulsas;
    const rotulo = proximaEhPodio
      ? totalPodio === 1
        ? "Revelar o campeão"
        : "Revelar o pódio (top 3)"
      : `Revelar ${total - avulsasReveladas}º lugar`;
    botaoHtml = `<button class="primario" data-action="revelar-proximo">${rotulo}</button>`;
  }

  container.innerHTML = `${cabecalho}
    <div class="ranking-revelacao">
      <div class="ranking-avulsas">${avulsasHtml.join("")}</div>
      ${corpoPodio}
      <div class="linha-acoes">
        ${botaoHtml}
        <button data-action="reiniciar-revelacao">Recomeçar revelação</button>
      </div>
    </div>`;

  container.querySelector("[data-action='revelar-proximo']")?.addEventListener("click", () => {
    nivelRevelado++;
    renderizarRanking(container, estado);
  });

  container.querySelector("[data-action='reiniciar-revelacao']")?.addEventListener("click", () => {
    nivelRevelado = 0;
    renderizarRanking(container, estado);
  });
}

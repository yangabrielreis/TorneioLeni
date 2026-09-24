/**
 * Varre o build do site dos alunos e falha se encontrar qualquer uma das
 * senhas de equipe ou a senha de admin no HTML/JS gerado. As senhas nunca
 * devem ir para o front-end: só existem como segredo nas Cloudflare Functions.
 *
 * Os valores reais só existem localmente em `.dev.vars` (fora do git). Sem
 * esse arquivo (ex.: checkout novo, CI sem segredos configurados) o teste é
 * pulado, porque não há segredo real para procurar.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIR_APP = join(__dirname);
const DIR_DIST = join(DIR_APP, "dist");
const ARQUIVO_DEV_VARS = join(DIR_APP, ".dev.vars");

function parsearDevVars(texto: string): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const linhaBruta of texto.split("\n")) {
    const linha = linhaBruta.trim();
    if (!linha || linha.startsWith("#")) continue;
    const i = linha.indexOf("=");
    if (i === -1) continue;
    resultado[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
  }
  return resultado;
}

function listarArquivos(dir: string): string[] {
  const itens = readdirSync(dir);
  const arquivos: string[] = [];
  for (const item of itens) {
    const caminho = join(dir, item);
    if (statSync(caminho).isDirectory()) arquivos.push(...listarArquivos(caminho));
    else arquivos.push(caminho);
  }
  return arquivos;
}

const temDevVars = existsSync(ARQUIVO_DEV_VARS);
const descrever = temDevVars ? describe : describe.skip;

descrever("build do site dos alunos não contém segredos", () => {
  let segredos: { nome: string; valor: string }[] = [];

  beforeAll(() => {
    const vars = parsearDevVars(readFileSync(ARQUIVO_DEV_VARS, "utf8"));
    const senhas = JSON.parse(vars.SENHAS_EQUIPES || "{}") as Record<string, string>;
    segredos = [
      ...Object.entries(senhas).map(([equipe, senha]) => ({ nome: `senha da equipe "${equipe}"`, valor: senha })),
      { nome: "senha do admin", valor: vars.ADMIN_SENHA },
      { nome: "TOKEN_SEGREDO", valor: vars.TOKEN_SEGREDO },
    ].filter((s) => s.valor && s.valor.length > 0);

    execSync("npm run build", { cwd: DIR_APP, stdio: "pipe" });
  }, 60_000);

  it("encontrou pelo menos um segredo em .dev.vars para procurar", () => {
    expect(segredos.length).toBeGreaterThan(0);
  });

  it("nenhum arquivo do dist contém alguma das senhas/segredos", () => {
    const arquivos = listarArquivos(DIR_DIST);
    const achados: string[] = [];
    for (const caminho of arquivos) {
      const buffer = readFileSync(caminho);
      for (const segredo of segredos) {
        if (buffer.includes(Buffer.from(segredo.valor, "utf8"))) {
          achados.push(`${segredo.nome} encontrada em ${caminho.replace(DIR_APP, "")}`);
        }
      }
    }
    expect(achados).toEqual([]);
  });
});

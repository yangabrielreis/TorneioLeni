import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { TEMAS, ddlTema, insertsExemploTema, consultaExibicaoTema } from "./themes";
import { verificarScriptAluno } from "./schema-check";

const tema = TEMAS.find((t) => t.id === "filme")!;

function todosOsNomesEsperados(): string[] {
  return [tema.tabelaPai, tema.tabelaFilha, tema.colunaItem, `id_${tema.tabelaPai}`, `id_${tema.tabelaFilha}`];
}

describe("schema-check: verificação do script do aluno", () => {
  it("script correto passa em todos os itens da checklist", async () => {
    const db = new PGlite();
    try {
      const script = `${ddlTema(tema)}\n${insertsExemploTema(tema)}\n${consultaExibicaoTema(tema)}`;
      const r = await verificarScriptAluno(db, tema, script);
      expect(r.ok).toBe(true);
      expect(r.checklist.every((i) => i.ok)).toBe(true);
      expect(r.mensagens).toEqual([]);
      expect(r.erro).toBeUndefined();
      expect(r.ultimoSelect?.rows).toHaveLength(1);
    } finally {
      await db.close();
    }
  });

  it("nome de coluna trocado: falha a checklist de tabelas, sem revelar os nomes esperados", async () => {
    const db = new PGlite();
    try {
      const script = `
        CREATE TABLE ${tema.tabelaPai} (
          id_${tema.tabelaPai} SERIAL PRIMARY KEY,
          nome VARCHAR(${tema.tamanhoPai}) NOT NULL
        );
        CREATE TABLE ${tema.tabelaFilha} (
          id_${tema.tabelaFilha} SERIAL PRIMARY KEY,
          coluna_errada VARCHAR(100) NOT NULL,
          id_${tema.tabelaPai} INTEGER NOT NULL REFERENCES ${tema.tabelaPai}(id_${tema.tabelaPai})
        );
        INSERT INTO ${tema.tabelaPai} (nome) VALUES ('X');
        INSERT INTO ${tema.tabelaFilha} (coluna_errada, id_${tema.tabelaPai}) VALUES ('Y', 1);
      `;
      const r = await verificarScriptAluno(db, tema, script);
      expect(r.ok).toBe(false);
      expect(r.checklist.find((i) => i.chave === "tabelas")?.ok).toBe(false);
      expect(r.mensagens.length).toBeGreaterThan(0);
      const textoMensagens = r.mensagens.join(" ");
      for (const nome of todosOsNomesEsperados()) {
        expect(textoMensagens).not.toContain(nome);
      }
    } finally {
      await db.close();
    }
  });

  it("sem FK: tabelas existem mas a checklist de FK falha", async () => {
    const db = new PGlite();
    try {
      const script = `
        CREATE TABLE ${tema.tabelaPai} (
          id_${tema.tabelaPai} SERIAL PRIMARY KEY,
          nome VARCHAR(${tema.tamanhoPai}) NOT NULL
        );
        CREATE TABLE ${tema.tabelaFilha} (
          id_${tema.tabelaFilha} SERIAL PRIMARY KEY,
          ${tema.colunaItem} VARCHAR(100) NOT NULL,
          id_${tema.tabelaPai} INTEGER NOT NULL
        );
        INSERT INTO ${tema.tabelaPai} (nome) VALUES ('X');
        INSERT INTO ${tema.tabelaFilha} (${tema.colunaItem}, id_${tema.tabelaPai}) VALUES ('Y', 1);
      `;
      const r = await verificarScriptAluno(db, tema, script);
      expect(r.checklist.find((i) => i.chave === "tabelas")?.ok).toBe(true);
      expect(r.checklist.find((i) => i.chave === "fk")?.ok).toBe(false);
      expect(r.ok).toBe(false);
    } finally {
      await db.close();
    }
  });

  it("INSERT fora de ordem (erro de FK): falha com mensagem útil e sem revelar os nomes esperados", async () => {
    const db = new PGlite();
    try {
      const script = `${ddlTema(tema)}
        INSERT INTO ${tema.tabelaFilha} (${tema.colunaItem}, id_${tema.tabelaPai}) VALUES ('Y', 1);
        INSERT INTO ${tema.tabelaPai} (nome) VALUES ('X');
      `;
      const r = await verificarScriptAluno(db, tema, script);
      expect(r.erro).toBeDefined();
      expect(r.erro!.message).toMatch(/violates foreign key constraint/i);
      expect(r.checklist.find((i) => i.chave === "linhas")?.ok).toBe(false);
      expect(r.ok).toBe(false);
      const textoMensagens = r.mensagens.join(" ");
      expect(textoMensagens.length).toBeGreaterThan(0);
    } finally {
      await db.close();
    }
  });
});

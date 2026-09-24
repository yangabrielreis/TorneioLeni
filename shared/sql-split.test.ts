import { describe, expect, it } from "vitest";
import { dividirEmComandos, removerComentariosSql } from "./sql-split";

describe("dividirEmComandos: comentários não confundem a divisão", () => {
  it("não corta no ';' dentro de um comentário de linha", () => {
    const r = dividirEmComandos("-- não separa aqui; de verdade\nSELECT 1;");
    expect(r.completos).toHaveLength(1);
    expect(r.resto).toBe("");
  });

  it("não trava a detecção de aspas por causa de apóstrofo num comentário", () => {
    // sem tratamento de comentário, o apóstrofo de "não" deixaria o parser
    // achando que está "dentro de uma string" para sempre
    const r = dividirEmComandos("-- não esquecer\nINSERT INTO t (nome) VALUES ('a');\nSELECT 1;");
    expect(r.completos).toHaveLength(2);
  });

  it("não corta no ';' dentro de um comentário de bloco", () => {
    const r = dividirEmComandos("/* comentário; com ponto e vírgula */\nSELECT 1;");
    expect(r.completos).toHaveLength(1);
  });

  it("um comentário antes do SELECT continua fazendo parte do mesmo comando", () => {
    const r = dividirEmComandos("-- 3) Consultar com JOIN\nSELECT 1 JOIN nada;");
    expect(r.completos).toHaveLength(1);
    expect(r.completos[0]).toContain("SELECT 1 JOIN nada");
  });
});

describe("removerComentariosSql", () => {
  it("remove comentário de linha, preservando o resto", () => {
    expect(removerComentariosSql("SELECT 1; -- comentário\nSELECT 2;")).toBe("SELECT 1; \nSELECT 2;");
  });

  it("remove comentário de bloco", () => {
    expect(removerComentariosSql("SELECT /* x */ 1;")).toBe("SELECT  1;");
  });

  it("não mexe em '--' ou '/*' dentro de uma string", () => {
    expect(removerComentariosSql("SELECT '--não é comentário';")).toBe("SELECT '--não é comentário';");
  });

  it("depois de remover comentários, dá pra achar o SELECT no início mesmo com comentário antes", () => {
    const original = "-- 3) Consultar com JOIN\nSELECT f.nome FROM f JOIN p ON f.id = p.id;";
    const limpo = removerComentariosSql(original).trim();
    expect(/^select\b/i.test(limpo)).toBe(true);
    expect(/\bjoin\b/i.test(limpo)).toBe(true);
  });
});

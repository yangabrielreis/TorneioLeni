import { describe, expect, it } from "vitest";
import { comandoBloqueadoDDL, dividirEmComandos, formatarTabelaPsql, formatarErro } from "./sql-console";

describe("motor do console psql", () => {
  it("divide comandos completos e mantém o resto como continuação", () => {
    const r = dividirEmComandos("SELECT 1;\nSELECT 2");
    expect(r.completos).toEqual(["SELECT 1;"]);
    expect(r.resto).toBe("\nSELECT 2");
  });

  it("não corta ';' dentro de aspas simples", () => {
    const r = dividirEmComandos("INSERT INTO t (nome) VALUES ('a;b');");
    expect(r.completos).toHaveLength(1);
    expect(r.resto).toBe("");
  });

  it("trata escape de aspas duplicadas corretamente", () => {
    const r = dividirEmComandos("INSERT INTO t (nome) VALUES ('a''b');SELECT 1;");
    expect(r.completos).toHaveLength(2);
  });

  it("mantém buffer incompleto sem ';' como resto (linha de continuação)", () => {
    const r = dividirEmComandos("SELECT *\nFROM filme");
    expect(r.completos).toHaveLength(0);
    expect(r.resto).toBe("SELECT *\nFROM filme");
  });

  it("bloqueia DDL (CREATE/DROP/ALTER/TRUNCATE)", () => {
    expect(comandoBloqueadoDDL("CREATE TABLE x (id INT);")).toBe(true);
    expect(comandoBloqueadoDDL("  drop table x;")).toBe(true);
    expect(comandoBloqueadoDDL("ALTER TABLE x ADD COLUMN y INT;")).toBe(true);
    expect(comandoBloqueadoDDL("truncate table x;")).toBe(true);
    expect(comandoBloqueadoDDL("SELECT * FROM x;")).toBe(false);
    expect(comandoBloqueadoDDL("INSERT INTO x VALUES (1);")).toBe(false);
  });

  it("bloqueia DDL mesmo com um comentário antes do comando", () => {
    expect(comandoBloqueadoDDL("-- vou criar a tabela\nCREATE TABLE x (id INT);")).toBe(true);
    expect(comandoBloqueadoDDL("/* apaga */ DROP TABLE x;")).toBe(true);
  });

  it("formata tabela ASCII no estilo psql com (N rows)", () => {
    const saida = formatarTabelaPsql(
      [
        { name: "id_diretor", dataTypeID: 23 },
        { name: "nome", dataTypeID: 1043 },
      ],
      [{ id_diretor: 1, nome: "Christopher Nolan" }],
    );
    expect(saida).toContain("(1 row)");
    expect(saida.split("\n")[0]).toContain("id_diretor");
    expect(saida.split("\n")[1]).toMatch(/^-+\+-+$/);
  });

  it("formata erro com DETAIL quando presente", () => {
    const saida = formatarErro({ message: "mensagem X", detail: "detalhe Y" });
    expect(saida).toBe("ERROR:  mensagem X\nDETAIL:  detalhe Y");
  });

  it("formata erro sem DETAIL quando ausente", () => {
    const saida = formatarErro({ message: "mensagem X" });
    expect(saida).toBe("ERROR:  mensagem X");
  });
});

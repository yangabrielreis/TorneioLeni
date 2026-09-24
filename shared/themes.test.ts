import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  TEMAS,
  ddlTema,
  consultaExibicaoTema,
  insertsExemploTema,
  rotuloItem,
} from "./themes";

describe("DDL e consulta de exibição de cada tema (PGlite)", () => {
  it("existem exatamente 8 temas, cada um com pai/filha diferentes", () => {
    expect(TEMAS).toHaveLength(8);
  });

  for (const tema of TEMAS) {
    it(`tema "${tema.nome}": cria schema, insere exemplo e exibe com JOIN`, async () => {
      const db = new PGlite();
      try {
        await db.exec(ddlTema(tema));
        await db.exec(insertsExemploTema(tema));

        const ret = await db.query<{ id: number; item: string; relacionado: string }>(
          consultaExibicaoTema(tema),
        );

        expect(ret.rows).toHaveLength(1);
        const linha = ret.rows[0];
        expect(linha.id).toBe(1);
        expect(linha.item).toBe(tema.exemploItem);
        expect(linha.relacionado).toBe(tema.exemploPai);
        expect(rotuloItem(linha.item, linha.relacionado)).toBe(
          `${tema.exemploItem} (${tema.exemploPai})`,
        );
      } finally {
        await db.close();
      }
    });
  }

  it("bloqueia FK: inserir na filha com id_pai inexistente falha", async () => {
    const tema = TEMAS[0];
    const db = new PGlite();
    try {
      await db.exec(ddlTema(tema));
      await expect(
        db.exec(
          `INSERT INTO ${tema.tabelaFilha} (${tema.colunaItem}, id_${tema.tabelaPai}) VALUES ('X', 999);`,
        ),
      ).rejects.toThrow(/violates foreign key constraint/i);
    } finally {
      await db.close();
    }
  });
});

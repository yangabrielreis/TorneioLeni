import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { TEMAS, ddlTema, schemaTema } from "../../../shared/themes";
import { cadastrarItemRapido } from "./console-controller";

const tema = TEMAS.find((t) => t.id === "banda")!;

async function criarBancoComTema(): Promise<PGlite> {
  const db = new PGlite();
  const schema = schemaTema(tema);
  await db.exec(`CREATE SCHEMA "${schema}";`);
  await db.exec(`SET search_path TO "${schema}";\n${ddlTema(tema)}`);
  return db;
}

describe("cadastrarItemRapido", () => {
  it("cria pai e filha novos quando o nome do pai ainda não existe", async () => {
    const db = await criarBancoComTema();
    try {
      const r = await cadastrarItemRapido({ db, tema, relacionado: "Brasil", item: "Legião Urbana" });
      const pais = await db.query<{ nome: string }>(`SELECT nome FROM pais;`);
      expect(pais.rows).toHaveLength(1);
      expect(pais.rows[0].nome).toBe("Brasil");
      expect(r.linhas.some((l) => l.tipo === "comando" && l.texto.includes("INSERT INTO pais"))).toBe(true);
    } finally {
      await db.close();
    }
  });

  it("duas bandas do mesmo país reaproveitam a mesma linha de pai, sem duplicar", async () => {
    const db = await criarBancoComTema();
    try {
      const r1 = await cadastrarItemRapido({ db, tema, relacionado: "Brasil", item: "Legião Urbana" });
      const r2 = await cadastrarItemRapido({ db, tema, relacionado: "  brasil  ", item: "Titãs" });

      const pais = await db.query<{ nome: string }>(`SELECT nome FROM pais;`);
      expect(pais.rows).toHaveLength(1);

      const bandas = await db.query<{ id_pais: number }>(`SELECT id_pais FROM banda ORDER BY id_banda;`);
      expect(bandas.rows).toHaveLength(2);
      expect(bandas.rows[0].id_pais).toBe(bandas.rows[1].id_pais);

      expect(r1.idFilha).not.toBe(r2.idFilha);
      // a segunda chamada não deve gerar um novo INSERT INTO pais
      expect(r2.linhas.some((l) => l.tipo === "comando" && l.texto.includes("INSERT INTO pais"))).toBe(false);
      expect(r2.linhas.some((l) => l.tipo === "info" && l.texto.includes("reaproveitando"))).toBe(true);
    } finally {
      await db.close();
    }
  });
});

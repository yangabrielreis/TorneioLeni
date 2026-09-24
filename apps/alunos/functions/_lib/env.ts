export interface Env {
  TORNEIO_KV: KVNamespace;
  /** JSON: { "Nome da Equipe": "senha", ... } */
  SENHAS_EQUIPES: string;
  ADMIN_SENHA: string;
  TOKEN_SEGREDO: string;
}

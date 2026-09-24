/** Tipos compartilhados entre o front-end do site dos alunos e as Functions do backend. */

export interface Submissao {
  sql: string;
  enviadoEm: string;
  ok: boolean;
  mensagem?: string;
}

export interface StatusEquipe {
  equipe: string;
  enviou: boolean;
  ok: boolean | null;
  ultimoEnvio: string | null;
}

// Mensagens de erro do Supabase Auth traduzidas para PT-BR.
const MAP: Record<string, string> = {
  "invalid login credentials": "E-mail ou senha inválidos.",
  "email not confirmed": "Confirme seu e-mail antes de entrar.",
  "user already registered": "Este e-mail já possui cadastro.",
  "user already exists": "Este e-mail já possui cadastro.",
  "email address already registered": "Este e-mail já possui cadastro.",
  "password should be at least 8 characters": "A senha deve ter no mínimo 8 caracteres.",
  "password should be at least 6 characters": "A senha deve ter no mínimo 6 caracteres.",
  "signup is disabled": "Cadastros estão temporariamente desabilitados.",
  "unable to validate email address: invalid format": "Formato de e-mail inválido.",
  "for security purposes, you can only request this after":
    "Aguarde alguns segundos antes de tentar novamente.",
  "new password should be different from the old password":
    "A nova senha deve ser diferente da anterior.",
  "email rate limit exceeded": "Muitos e-mails enviados. Tente novamente em instantes.",
  "over email send rate limit": "Muitos e-mails enviados. Tente novamente em instantes.",
};

export function translateAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const key = raw.toLowerCase();
  for (const k of Object.keys(MAP)) {
    if (key.includes(k)) return MAP[k];
  }
  return raw || "Falha na autenticação.";
}

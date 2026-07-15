import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const security = read("supabase/migrations/20260716120000_phase17_21_security_quality_demo.sql");
const storage = read("supabase/migrations/20260716030000_phase11_12_traceability_storage.sql");
const landing = read("src/routes/index.tsx");
const client = read("src/integrations/supabase/client.ts");

test("RLS é obrigatório nas entidades sensíveis e usuários suspensos são bloqueados", () => {
  for (const table of [
    "batteries",
    "collections",
    "lots",
    "proposals",
    "operations",
    "documents",
    "private_documents",
    "notifications",
  ]) {
    assert.match(security, new RegExp(`'${table}'`));
  }
  assert.match(security, /is_user_active\(auth\.uid\(\)\)/);
  assert.match(security, /account_suspended/);
});

test("propostas concorrentes e ordens não atribuídas não recebem política aberta", () => {
  assert.match(security, /proposal recycler reads own/);
  assert.match(security, /carrier reads assigned collections/);
  assert.doesNotMatch(security, /CREATE POLICY "carrier reads open or assigned collections"/);
});

test("buckets de documentos são privados e exigem autorização", () => {
  assert.match(storage, /public=FALSE/);
  assert.match(security, /UPDATE storage\.buckets SET public=FALSE/);
  assert.match(security, /can_access_private_document/);
  assert.match(security, /workflow documents read authorized/);
});

test("service role não é referenciada pelo cliente web", () => {
  assert.doesNotMatch(client, /SERVICE_ROLE|service_role|sb_secret_/);
  assert.match(client, /VITE_SUPABASE_PUBLISHABLE_KEY/);
});

test("landing identifica simulação, mantém avisos e oferece CTAs funcionais", () => {
  for (const text of [
    "Exemplo visual / simulação",
    "Cadastrar bateria",
    "Cadastrar empresa",
    "Entrar",
    "Falar com a equipe",
  ]) {
    assert.match(landing, new RegExp(text));
  }
  assert.match(landing, /Segunda vida/);
  assert.match(landing, /Reutilização de componentes/);
  assert.match(landing, /Reciclagem mecânica/);
  assert.match(landing, /Reciclagem química/);
  assert.match(landing, /Destinação final/);
});

test("rotas institucionais e operacionais existem", () => {
  for (const route of [
    "auth",
    "contato",
    "termos",
    "privacidade",
    "portal",
    "rastreio.$token",
    "_authenticated/app",
  ]) {
    assert.equal(
      existsSync(resolve(root, `src/routes/${route}.tsx`)),
      true,
      `rota ausente: ${route}`,
    );
  }
});

test("seed demonstrativo é separado e bloqueado fora de ambiente isolado", () => {
  const seed = read("supabase/seed.demo.sql");
  assert.match(seed, /app\.environment/);
  assert.match(seed, /is_demo=TRUE|is_demo,TRUE/);
  assert.match(seed, /Ambiente|Seed demonstrativo bloqueado/);
});

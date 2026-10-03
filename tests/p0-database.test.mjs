import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const uid = "11111111-1111-4111-8111-111111111111";
const admin = "22222222-2222-4222-8222-222222222222";
const meta = {
  full_name: "Teste",
  phone: "41999999999",
  company_name: "Empresa de teste",
  cnpj_cpf: "37796435000102",
  requested_role: "gerador",
  tipo_organizacao: "Indústria",
  cargo: "Responsável",
  endereco: "Rua de teste",
  cidade: "Curitiba",
  estado: "PR",
  cep: "80010000",
  accepted_terms: true,
  accepted_privacy: true,
  accepted_data_processing: true,
};

async function database(t, metadata = meta) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(read("tests/fixtures/p0-database.sql"));
  await db.exec(
    read("supabase/migrations/20260712010027_8d27a67b-257e-48ce-8a51-067c3c5811ed.sql"),
  );
  await db.exec(
    read("supabase/migrations/20260714115352_672532cd-74a9-45fe-98d1-a5e9e85d74a2.sql"),
  );
  await db.exec(`
    ALTER TABLE public.profiles ADD COLUMN nome TEXT, ADD COLUMN telefone TEXT,
      ADD COLUMN avatar_url TEXT, ADD COLUMN timezone TEXT DEFAULT 'America/Sao_Paulo',
      ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN suspended_at TIMESTAMPTZ,
      ADD COLUMN suspension_reason TEXT;
    ALTER TABLE public.companies ADD COLUMN cnpj_cpf TEXT, ADD COLUMN email TEXT,
      ADD COLUMN telefone TEXT, ADD COLUMN status_aprovacao TEXT,
      ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE,
      ADD CONSTRAINT uf_check CHECK (estado IN ('PR','SP'));
    CREATE UNIQUE INDEX company_document ON public.companies(cnpj_cpf);
    CREATE FUNCTION public.only_digits(TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
      SELECT regexp_replace(COALESCE($1,''),'[^0-9]','','g')
    $$;
    CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
      RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
      SELECT EXISTS (SELECT 1 FROM user_roles r JOIN profiles p ON p.id=r.user_id
        WHERE r.user_id=_user_id AND r.role=_role AND p.status='approved' AND p.suspended_at IS NULL)
    $$;
  `);
  await db.exec(read("supabase/migrations/20261003190000_p0_profile_and_signup.sql"));
  await db.query(
    "INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES($1,'user@example.test',now(),$2)",
    [uid, metadata],
  );
  await db.exec(
    `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${uid}',false);`,
  );
  return db;
}
const count = async (db, table) =>
  Number((await db.query(`SELECT count(*) AS n FROM public.${table}`)).rows[0].n);

test("authenticated user can edit name but cannot self-approve, clear suspension or change demo context", async (t) => {
  const db = await database(t);
  await db.exec(`UPDATE public.profiles SET full_name='Nome atualizado' WHERE id='${uid}'`);
  assert.equal(
    (await db.query("SELECT full_name FROM public.profiles")).rows[0].full_name,
    "Nome atualizado",
  );
  for (const assignment of [
    "status='approved'",
    "suspended_at=NULL",
    "suspension_reason=NULL",
    "is_demo=TRUE",
  ]) {
    await assert.rejects(
      db.exec(`UPDATE public.profiles SET ${assignment} WHERE id='${uid}'`),
      /permission denied/i,
    );
  }
  assert.equal((await db.query("SELECT status FROM public.profiles")).rows[0].status, "pending");
});

test("signup completes after email confirmation, preserving pending state and avoiding duplicates", async (t) => {
  const db = await database(t);
  await db.exec(
    `RESET ROLE; UPDATE auth.users SET email_confirmed_at=NULL WHERE id='${uid}'; SET ROLE authenticated;`,
  );
  assert.equal(
    (await db.query("SELECT public.complete_signup_registration() AS completed")).rows[0].completed,
    false,
  );
  assert.equal(await count(db, "companies"), 0);
  await db.exec(
    `RESET ROLE; UPDATE auth.users SET email_confirmed_at=now() WHERE id='${uid}'; SET ROLE authenticated;`,
  );
  assert.equal(
    (await db.query("SELECT public.complete_signup_registration() AS completed")).rows[0].completed,
    true,
  );
  await db.exec("SELECT public.complete_signup_registration()");
  assert.equal(await count(db, "companies"), 1);
  assert.equal(await count(db, "registration_requests"), 1);
  const request = (await db.query("SELECT * FROM public.registration_requests")).rows[0];
  assert.equal(request.status, "pending");
  assert.equal(request.company_data.cidade, "Curitiba");
  assert.ok(request.company_data.organization_id);
  assert.equal(await count(db, "user_roles"), 0);
  assert.ok(
    (await db.query("SELECT aceite_termos_at FROM public.profiles")).rows[0].aceite_termos_at,
  );
});

test("database failure rolls back profile enrichment and company/request creation", async (t) => {
  const db = await database(t, { ...meta, estado: "INVALID" });
  await assert.rejects(db.exec("SELECT public.complete_signup_registration()"), /uf_check/);
  assert.equal(await count(db, "companies"), 0);
  assert.equal(await count(db, "registration_requests"), 0);
  assert.equal(
    (await db.query("SELECT aceite_termos_at FROM public.profiles")).rows[0].aceite_termos_at,
    null,
  );
});

test("metadata cannot request admin access and anonymous callers cannot complete signup", async (t) => {
  const db = await database(t, { ...meta, requested_role: "admin" });
  assert.equal(
    (await db.query("SELECT public.complete_signup_registration() AS completed")).rows[0].completed,
    false,
  );
  assert.equal(await count(db, "registration_requests"), 0);
  await db.exec("RESET ROLE; SET ROLE anon;");
  await assert.rejects(
    db.exec("SELECT public.complete_signup_registration()"),
    /permission denied/,
  );
});

test("authorized admin RPC still approves after column privilege restriction", async (t) => {
  const db = await database(t);
  await db.exec("SELECT public.complete_signup_registration()");
  const id = (await db.query("SELECT id FROM public.registration_requests")).rows[0].id;
  await assert.rejects(
    db.query("SELECT public.approve_registration($1,true)", [id]),
    /Only admins/,
  );
  await db.exec(`RESET ROLE;
    INSERT INTO auth.users(id,email) VALUES('${admin}','admin@example.test');
    UPDATE public.profiles SET status='approved' WHERE id='${admin}';
    INSERT INTO public.user_roles(user_id,role) VALUES('${admin}','admin');
    SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${admin}',false);`);
  await db.query("SELECT public.approve_registration($1,true)", [id]);
  assert.equal(
    (await db.query(`SELECT status FROM public.profiles WHERE id='${uid}'`)).rows[0].status,
    "approved",
  );
});

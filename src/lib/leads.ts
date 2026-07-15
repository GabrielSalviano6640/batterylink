import { supabase } from "@/integrations/supabase/client";

export type LeadSource = "gerador" | "recicladora" | "transportadora" | "operador" | "contato";

export async function submitLead(source: LeadSource, form: HTMLFormElement): Promise<string> {
  const fd = new FormData(form);
  const payload: Record<string, unknown> = {};
  fd.forEach((v, k) => {
    const existing = payload[k];
    const value = typeof v === "string" ? v : (v as File).name;
    if (existing === undefined) payload[k] = value;
    else if (Array.isArray(existing)) (existing as string[]).push(value);
    else payload[k] = [existing as string, value];
  });
  const str = (k: string) => (typeof payload[k] === "string" ? (payload[k] as string) : null);
  const { data, error } = await supabase
    .from("leads")
    .insert({
      source,
      razao_social: str("razao_social"),
      documento: str("documento"),
      responsavel: str("responsavel"),
      email: str("email"),
      phone: str("phone"),
      cidade: str("cidade"),
      estado: str("estado"),
      payload: payload as never,
    })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return (data?.id ?? "").slice(0, 6).toUpperCase() || "OK";
}

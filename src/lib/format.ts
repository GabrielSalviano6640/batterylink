export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

export function formatDateTimeBR(
  value: string | Date | null | undefined,
  timeZone = DEFAULT_TIME_ZONE,
) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

export function formatDateBR(
  value: string | Date | null | undefined,
  timeZone = DEFAULT_TIME_ZONE,
) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone }).format(date);
}

export function formatCurrencyBRL(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value ?? 0),
  );
}

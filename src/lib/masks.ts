// Máscaras de entrada para documentos e telefones brasileiros.
// Uso: <input onInput={maskInput(maskCNPJ)} /> em campos não controlados,
// ou onChange={(e) => setX(maskCNPJ(e.target.value))} em controlados.

export const onlyDigits = (v: string) => v.replace(/\D/g, "");

function hasRepeatedDigits(value: string) {
  return /^(\d)\1+$/.test(value);
}

export function isValidCPF(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || hasRepeatedDigits(digits)) return false;
  const check = (length: number) => {
    const sum = digits
      .slice(0, length)
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return (remainder === 10 ? 0 : remainder) === Number(digits[length]);
  };
  return check(9) && check(10);
}

export function isValidCNPJ(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || hasRepeatedDigits(digits)) return false;
  const calculate = (length: number) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = digits
      .slice(0, length)
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return (remainder < 2 ? 0 : 11 - remainder) === Number(digits[length]);
  };
  return calculate(12) && calculate(13);
}

export function isValidCPFOrCNPJ(value: string) {
  return onlyDigits(value).length <= 11 ? isValidCPF(value) : isValidCNPJ(value);
}

export function isValidCEP(value: string) {
  return onlyDigits(value).length === 8;
}

export function isValidPhone(value: string) {
  return [10, 11].includes(onlyDigits(value).length);
}

export const BRAZILIAN_UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export function isValidUF(value: string) {
  return BRAZILIAN_UFS.includes(value.toUpperCase() as (typeof BRAZILIAN_UFS)[number]);
}

export function maskCNPJ(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function maskCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskCPFOrCNPJ(value: string): string {
  const d = onlyDigits(value);
  return d.length <= 11 ? maskCPF(value) : maskCNPJ(value);
}

export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export function maskCEP(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

/** Handler para inputs não controlados: formata o valor no próprio elemento. */
export function maskInput(fn: (v: string) => string) {
  return (e: React.FormEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    el.value = fn(el.value);
  };
}

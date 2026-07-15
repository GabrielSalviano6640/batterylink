// Máscaras de entrada para documentos e telefones brasileiros.
// Uso: <input onInput={maskInput(maskCNPJ)} /> em campos não controlados,
// ou onChange={(e) => setX(maskCNPJ(e.target.value))} em controlados.

const onlyDigits = (v: string) => v.replace(/\D/g, "");

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
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
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

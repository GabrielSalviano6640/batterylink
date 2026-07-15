import jsPDF from "jspdf";
import type { Tables } from "@/integrations/supabase/types";

type Battery = Tables<"batteries">;

const statusPt: Record<string, string> = {
  delivered: "Entregue",
  recycled: "Reciclada",
  second_life: "Destinada a segunda vida",
};

export function generateCertificate(battery: Battery, companyName?: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 90, "F");
  doc.setTextColor(212, 255, 61);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("BATTERYLINK BRASIL", 40, 45);
  doc.setTextColor(226, 232, 240);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Certificado de destinação — rastreabilidade de baterias", 40, 65);

  // Title
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Certificado de Destinação Ambiental", 40, 130);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    "Documento informativo emitido eletronicamente pela plataforma BatteryLink Brasil.",
    40,
    148
  );
  doc.text(
    "A validação regulatória oficial requer conferência por profissional habilitado.",
    40,
    162
  );

  // QR
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(battery.code)}`;

  // Body
  const rows: [string, string][] = [
    ["Código", battery.code],
    ["Status", statusPt[battery.status] ?? battery.status],
    ["Origem", battery.origem],
    ["Química", battery.quimica],
    ["Fabricante / Modelo", [battery.fabricante, battery.modelo].filter(Boolean).join(" / ") || "—"],
    ["Capacidade", battery.capacidade_kwh ? `${battery.capacidade_kwh} kWh` : "—"],
    ["Quantidade", String(battery.quantidade)],
    ["Peso", battery.peso_kg ? `${battery.peso_kg} kg` : "—"],
    ["Localização", [battery.cidade, battery.uf].filter(Boolean).join("/") || "—"],
    ["Classificação", battery.classificacao === "segunda_vida" ? "Segunda vida" : battery.classificacao === "reciclagem" ? "Reciclagem" : "—"],
    ["Gerador (empresa)", companyName ?? "—"],
    ["Emitido em", new Date().toLocaleString("pt-BR")],
  ];

  let y = 200;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  rows.forEach(([k, v], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(40, y - 12, W - 80, 20, "F");
    }
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(k.toUpperCase(), 50, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(String(v), 200, y);
    y += 20;
  });

  // QR image (async load)
  const img = new Image();
  img.crossOrigin = "anonymous";
  return new Promise<void>((resolve) => {
    img.onload = () => {
      doc.addImage(img, "PNG", W - 160, y + 10, 120, 120);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text("Rastreio: " + battery.code, W - 160, y + 145);

      // Disclaimer
      doc.setFontSize(8);
      doc.setTextColor(100);
      const disc =
        "Conteúdo informativo. A validação por profissional habilitado (ambiental / logística reversa) é obrigatória antes do uso oficial. " +
        "Documento gerado eletronicamente e vinculado ao histórico rastreável do código acima na plataforma BatteryLink Brasil.";
      const lines = doc.splitTextToSize(disc, W - 200);
      doc.text(lines, 40, y + 40);

      doc.save(`certificado-${battery.code}.pdf`);
      resolve();
    };
    img.onerror = () => {
      doc.save(`certificado-${battery.code}.pdf`);
      resolve();
    };
    img.src = qrUrl;
  });
}

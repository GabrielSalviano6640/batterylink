import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  maskPhone,
  maskCEP,
  onlyDigits,
  isValidCEP,
  isValidPhone,
  isValidUF,
  BRAZILIAN_UFS,
} from "@/lib/masks";
import { Upload, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/gerador/bateria/nova")({
  component: NovaBateria,
});

function NovaBateria() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [origem, setOrigem] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [modelo, setModelo] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [quimica, setQuimica] = useState("lfp");
  const [capacidadeKwh, setCapacidadeKwh] = useState("");
  const [tensao, setTensao] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [pesoKg, setPesoKg] = useState("");
  const [sohPercentual, setSohPercentual] = useState("");
  const [estadoAparente, setEstadoAparente] = useState("bom");
  const [possuiVazamento, setPossuiVazamento] = useState(false);
  const [possuiAvaria, setPossuiAvaria] = useState(false);
  const [possuiRiscoTermico, setPossuiRiscoTermico] = useState(false);
  const [urgencia, setUrgencia] = useState("normal");
  const [cepOrigem, setCepOrigem] = useState("");
  const [cidadeOrigem, setCidadeOrigem] = useState("");
  const [estadoOrigem, setEstadoOrigem] = useState("");
  const [enderecoColeta, setEnderecoColeta] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files) {
      setFotos([...fotos, ...Array.from(files)]);
    }
  };

  const handleFotoRemove = (index: number) => {
    setFotos(fotos.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!auth.user?.id) throw new Error("Usuário não autenticado.");
      const userId = auth.user.id;

      // Validar campos obrigatórios
      if (!origem.trim()) throw new Error("Informe a origem da bateria.");
      if (!fabricante.trim()) throw new Error("Informe o fabricante.");
      if (!modelo.trim()) throw new Error("Informe o modelo.");
      if (!numeroSerie.trim()) throw new Error("Informe o número de série.");
      if (!quantidade || parseInt(quantidade) < 1)
        throw new Error("Informe uma quantidade válida.");
      if (!isValidCEP(cepOrigem)) throw new Error("Informe um CEP válido com oito dígitos.");
      if (!cidadeOrigem.trim()) throw new Error("Informe a cidade de origem.");
      if (!isValidUF(estadoOrigem)) throw new Error("Informe uma UF válida.");
      if (!enderecoColeta.trim()) throw new Error("Informe o endereço de coleta.");

      // Encontrar organização do usuário
      const { data: companies } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_id", userId)
        .limit(1)
        .single();

      if (!companies) throw new Error("Usuário não vinculado a nenhuma organização.");

      // Criar bateria
      const { data: battery, error: batteryError } = await supabase
        .from("batteries")
        .insert({
          origem: origem.trim(),
          fabricante: fabricante.trim(),
          modelo: modelo.trim(),
          numero_serie: numeroSerie.trim(),
          quimica,
          capacidade_kwh: capacidadeKwh ? parseFloat(capacidadeKwh) : null,
          tensao: tensao ? parseFloat(tensao) : null,
          quantidade: parseInt(quantidade),
          peso_kg: pesoKg ? parseFloat(pesoKg) : null,
          soh_percentual: sohPercentual ? parseFloat(sohPercentual) : null,
          estado: estadoAparente,
          possui_vazamento: possuiVazamento,
          possui_avaria: possuiAvaria,
          possui_risco_termico: possuiRiscoTermico,
          urgencia,
          cep: onlyDigits(cepOrigem),
          cidade: cidadeOrigem.trim(),
          uf: estadoOrigem.toUpperCase(),
          endereco: enderecoColeta.trim(),
          observacoes: observacoes.trim(),
          status: "cadastrada",
          created_by: userId,
          company_id: companies.id,
          owner_id: userId,
        })
        .select("id, code, tracking_token, qr_code_data")
        .single();

      if (batteryError) throw batteryError;

      // Upload de fotos
      if (fotos.length > 0) {
        const uploadPromises = fotos.map(async (foto) => {
          const ext = foto.name.split(".").pop() || "jpg";
          const path = `batteries/${battery.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("battery-files")
            .upload(path, foto);
          if (uploadError) throw uploadError;
          return { path, name: foto.name };
        });

        const uploadedFiles = await Promise.all(uploadPromises);
        const { error: filesError } = await supabase.from("battery_files").insert(
          uploadedFiles.map((f) => ({
            battery_id: battery.id,
            storage_path: f.path,
            nome_arquivo: f.name,
            tipo: "foto",
            uploaded_by: userId,
          })),
        );
        if (filesError) throw filesError;
      }

      // Registrar evento
      await supabase.from("battery_events").insert({
        battery_id: battery.id,
        event_type: "cadastrada",
        actor_id: userId,
        notes: `Bateria cadastrada: ${fabricante} ${modelo}`,
      });

      toast.success(`Bateria cadastrada! Código: ${battery.code}`);
      navigate({ to: "/app/gerador", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar bateria.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-industrial px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">Cadastrar nova bateria</h1>
          <p className="text-slate-400 text-sm">
            Informe os dados técnicos e de localização para iniciar o rastreamento.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seção 1: Identificação */}
          <section className="bg-white/5 border border-white/10 rounded-lg p-6">
            <h2 className="text-sm font-mono uppercase tracking-widest text-brand mb-4">
              Identificação
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block text-xs text-slate-300">
                Origem *
                <input
                  required
                  type="text"
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  placeholder="Ex: Frotas ABC, Montadora XYZ"
                  className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                />
              </label>
              <label className="block text-xs text-slate-300">
                Fabricante *
                <input
                  required
                  type="text"
                  value={fabricante}
                  onChange={(e) => setFabricante(e.target.value)}
                  placeholder="Ex: LG, Samsung, BYD"
                  className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                />
              </label>
              <label className="block text-xs text-slate-300">
                Modelo *
                <input
                  required
                  type="text"
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  placeholder="Ex: 48V-100Ah"
                  className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                />
              </label>
              <label className="block text-xs text-slate-300">
                Número de série *
                <input
                  required
                  type="text"
                  value={numeroSerie}
                  onChange={(e) => setNumeroSerie(e.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                />
              </label>
            </div>
          </section>

          {/* Seção 2: Especificações técnicas */}
          <section className="bg-white/5 border border-white/10 rounded-lg p-6">
            <h2 className="text-sm font-mono uppercase tracking-widest text-brand mb-4">
              Especificações técnicas
            </h2>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <label className="block text-xs text-slate-300">
                Química *
                <select
                  required
                  value={quimica}
                  onChange={(e) => setQuimica(e.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                >
                  <option value="lfp">LFP</option>
                  <option value="nmc">NMC</option>
                  <option value="nca">NCA</option>
                  <option value="lto">LTO</option>
                  <option value="lmo">LMO</option>
                  <option value="lead">Chumbo-ácido</option>
                  <option value="outra">Outra</option>
                </select>
              </label>
              <label className="block text-xs text-slate-300">
                Capacidade (kWh)
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={capacidadeKwh}
                  onChange={(e) => setCapacidadeKwh(e.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                />
              </label>
              <label className="block text-xs text-slate-300">
                Tensão (V)
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={tensao}
                  onChange={(e) => setTensao(e.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                />
              </label>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <label className="block text-xs text-slate-300">
                Quantidade *
                <input
                  required
                  type="number"
                  min="1"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                />
              </label>
              <label className="block text-xs text-slate-300">
                Peso (kg)
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={pesoKg}
                  onChange={(e) => setPesoKg(e.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                />
              </label>
              <label className="block text-xs text-slate-300">
                SoH (%)
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={sohPercentual}
                  onChange={(e) => setSohPercentual(e.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                />
              </label>
            </div>
          </section>

          {/* Seção 3: Estado e riscos */}
          <section className="bg-white/5 border border-white/10 rounded-lg p-6">
            <h2 className="text-sm font-mono uppercase tracking-widest text-brand mb-4">
              Estado e riscos
            </h2>
            <div className="grid md:grid-cols-2 gap-6 mb-4">
              <label className="block text-xs text-slate-300">
                Estado aparente
                <select
                  value={estadoAparente}
                  onChange={(e) => setEstadoAparente(e.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                >
                  <option value="bom">Bom</option>
                  <option value="regular">Regular</option>
                  <option value="ruim">Ruim</option>
                </select>
              </label>
              <label className="block text-xs text-slate-300">
                Urgência
                <select
                  value={urgencia}
                  onChange={(e) => setUrgencia(e.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                >
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </select>
              </label>
            </div>

            <div className="space-y-2">
              <label className="flex gap-2 items-center text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={possuiVazamento}
                  onChange={(e) => setPossuiVazamento(e.target.checked)}
                  className="accent-brand"
                />
                Possui vazamento
              </label>
              <label className="flex gap-2 items-center text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={possuiAvaria}
                  onChange={(e) => setPossuiAvaria(e.target.checked)}
                  className="accent-brand"
                />
                Possui avaria estrutural
              </label>
              <label className="flex gap-2 items-center text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={possuiRiscoTermico}
                  onChange={(e) => setPossuiRiscoTermico(e.target.checked)}
                  className="accent-brand"
                />
                Possui risco térmico
              </label>
            </div>
          </section>

          {/* Seção 4: Localização */}
          <section className="bg-white/5 border border-white/10 rounded-lg p-6">
            <h2 className="text-sm font-mono uppercase tracking-widest text-brand mb-4">
              Localização
            </h2>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <label className="block text-xs text-slate-300">
                CEP *
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  value={cepOrigem}
                  onChange={(e) => setCepOrigem(e.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                />
              </label>
              <label className="block text-xs text-slate-300">
                Cidade *
                <input
                  required
                  type="text"
                  value={cidadeOrigem}
                  onChange={(e) => setCidadeOrigem(e.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                />
              </label>
              <label className="block text-xs text-slate-300">
                Estado (UF) *
                <select
                  required
                  value={estadoOrigem}
                  onChange={(e) => setEstadoOrigem(e.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                >
                  <option value="">UF</option>
                  {BRAZILIAN_UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-xs text-slate-300">
              Endereço de coleta *
              <input
                required
                type="text"
                value={enderecoColeta}
                onChange={(e) => setEnderecoColeta(e.target.value)}
                placeholder="Rua, número, complemento"
                className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
              />
            </label>
          </section>

          {/* Seção 5: Fotos e observações */}
          <section className="bg-white/5 border border-white/10 rounded-lg p-6">
            <h2 className="text-sm font-mono uppercase tracking-widest text-brand mb-4">
              Documentação
            </h2>
            <label className="block text-xs text-slate-300 mb-4">
              Fotos (opcional)
              <div className="mt-2 flex items-center justify-center w-full">
                <label className="relative w-full flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-lg p-6 cursor-pointer hover:border-brand/50 transition">
                  <div className="flex flex-col items-center justify-center">
                    <Upload className="w-6 h-6 text-slate-400 mb-2" />
                    <p className="text-sm text-slate-400">
                      Arraste fotos ou clique para selecionar
                    </p>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFotoAdd}
                    className="hidden"
                  />
                </label>
              </div>
            </label>

            {fotos.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-slate-400 mb-2">
                  {fotos.length} foto(s) selecionada(s):
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {fotos.map((foto, i) => (
                    <div key={i} className="relative">
                      <div className="aspect-square bg-white/10 rounded-md flex items-center justify-center overflow-hidden">
                        <img
                          src={URL.createObjectURL(foto)}
                          alt={foto.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFotoRemove(i)}
                        className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 hover:bg-red-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="block text-xs text-slate-300">
              Observações
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Informações adicionais relevantes para a triagem"
                rows={4}
                className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
              />
            </label>
          </section>

          {/* Botões */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate({ to: "/app/gerador" })}
              className="px-4 py-2.5 border border-white/20 rounded-md hover:bg-white/5 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 bg-brand text-industrial rounded-md font-semibold hover:brightness-110 transition disabled:opacity-50"
            >
              {loading ? "Cadastrando..." : "Cadastrar bateria"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

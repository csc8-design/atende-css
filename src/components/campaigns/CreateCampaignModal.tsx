import { useState, useEffect } from "react";
import { X, Search, Users, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  phone: string;
  whatsapp_id: string | null;
  tags: string[] | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const TEMPLATE_CATEGORIES = [
  { value: "MARKETING", label: "Marketing", desc: "Promoções e ofertas" },
  { value: "UTILITY", label: "Utilidade", desc: "Atualizações de pedidos, confirmações" },
];

export default function CreateCampaignModal({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("pt_BR");
  const [templateCategory, setTemplateCategory] = useState("MARKETING");
  const [batchSize, setBatchSize] = useState(50);
  const [batchDelay, setBatchDelay] = useState(5);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setName("");
      setDescription("");
      setTemplateName("");
      setSelectedIds(new Set());
      fetchContacts();
    }
  }, [open]);

  const fetchContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, name, phone, whatsapp_id, tags")
      .eq("is_active", true)
      .order("name");
    setContacts((data as Contact[]) || []);
  };

  const toggleContact = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const filtered = filteredContacts;
    const allSelected = filtered.every((c) => selectedIds.has(c.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((c) => (allSelected ? next.delete(c.id) : next.add(c.id)));
      return next;
    });
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
  );

  const handleCreate = async () => {
    if (!user) return;
    if (!name.trim()) return toast.error("Nome da campanha é obrigatório");
    if (!templateName.trim()) return toast.error("Nome do template é obrigatório (Meta exige templates aprovados para disparos em massa)");
    if (selectedIds.size === 0) return toast.error("Selecione pelo menos 1 contato");

    setSaving(true);
    try {
      const { data: campaign, error } = await supabase
        .from("campaigns")
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          template_name: templateName.trim(),
          template_language: templateLanguage,
          template_category: templateCategory,
          batch_size: batchSize,
          batch_delay_seconds: batchDelay,
          total_contacts: selectedIds.size,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Insert campaign contacts
      const contactRows = Array.from(selectedIds).map((contactId) => ({
        campaign_id: campaign.id,
        contact_id: contactId,
      }));

      const { error: contactsErr } = await supabase
        .from("campaign_contacts")
        .insert(contactRows);

      if (contactsErr) throw contactsErr;

      toast.success("Campanha criada com sucesso!");
      onCreated();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao criar campanha");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">Nova Campanha</h2>
            <p className="text-sm text-muted-foreground">Etapa {step} de 3</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {step === 1 && (
            <>
              {/* Meta compliance notice */}
              <div className="flex gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm text-foreground">
                  <p className="font-semibold mb-1">Regras da Meta para Disparos</p>
                  <ul className="text-muted-foreground space-y-1 text-xs list-disc ml-4">
                    <li>Obrigatório usar <strong>templates aprovados</strong> pela Meta</li>
                    <li>Templates devem ser aprovados no <strong>WhatsApp Business Manager</strong></li>
                    <li>Categoria Marketing requer <strong>opt-in</strong> do contato</li>
                    <li>Rate limiting automático para evitar bloqueios</li>
                  </ul>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Nome da Campanha *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Promoção de Verão"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Descrição</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição opcional..."
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Nome do Template (Meta) *</label>
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Ex: hello_world, promo_verao_2025"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use o nome exato do template aprovado no WhatsApp Business Manager
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Idioma</label>
                  <select
                    value={templateLanguage}
                    onChange={(e) => setTemplateLanguage(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm outline-none"
                  >
                    <option value="pt_BR">Português (BR)</option>
                    <option value="en_US">English (US)</option>
                    <option value="es">Español</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Categoria</label>
                  <select
                    value={templateCategory}
                    onChange={(e) => setTemplateCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm outline-none"
                  >
                    {TEMPLATE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label} — {cat.desc}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar contatos..."
                    className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm outline-none"
                  />
                </div>
                <button onClick={selectAll} className="px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors">
                  {filteredContacts.every((c) => selectedIds.has(c.id)) ? "Desmarcar todos" : "Selecionar todos"}
                </button>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{selectedIds.size} contato(s) selecionado(s) de {contacts.length}</span>
              </div>

              <div className="space-y-1 max-h-[350px] overflow-y-auto border border-border rounded-xl p-2">
                {filteredContacts.map((c) => (
                  <label
                    key={c.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      selectedIds.has(c.id) ? "bg-primary/10" : "hover:bg-secondary"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleContact(c.id)}
                      className="accent-primary w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.phone}</p>
                    </div>
                    {c.tags && c.tags.length > 0 && (
                      <div className="flex gap-1">
                        {c.tags.slice(0, 2).map((t) => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 bg-secondary rounded text-muted-foreground">{t}</span>
                        ))}
                      </div>
                    )}
                  </label>
                ))}
                {filteredContacts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum contato encontrado</p>
                )}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex gap-3 p-4 bg-warning/10 border border-warning/20 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground mb-1">Configurações de Envio</p>
                  <p className="text-muted-foreground text-xs">
                    Ajuste o rate limiting para respeitar os limites da Meta. Valores muito altos podem causar bloqueios temporários.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Tamanho do Lote</label>
                  <input
                    type="number"
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    min={1}
                    max={100}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm outline-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Mensagens por lote (recomendado: 30-50)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Intervalo entre Lotes (seg)</label>
                  <input
                    type="number"
                    value={batchDelay}
                    onChange={(e) => setBatchDelay(Number(e.target.value))}
                    min={1}
                    max={60}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm outline-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Segundos entre cada lote (recomendado: 5-10)</p>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-secondary/50 rounded-xl p-5 space-y-3">
                <h4 className="font-semibold text-foreground text-sm">Resumo da Campanha</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="text-muted-foreground">Nome:</p>
                  <p className="text-foreground font-medium">{name}</p>
                  <p className="text-muted-foreground">Template:</p>
                  <p className="text-foreground font-medium">{templateName}</p>
                  <p className="text-muted-foreground">Categoria:</p>
                  <p className="text-foreground font-medium">{templateCategory}</p>
                  <p className="text-muted-foreground">Contatos:</p>
                  <p className="text-foreground font-medium">{selectedIds.size}</p>
                  <p className="text-muted-foreground">Tempo estimado:</p>
                  <p className="text-foreground font-medium">
                    ~{Math.ceil(selectedIds.size / batchSize) * batchDelay}s
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {step > 1 ? "Voltar" : "Cancelar"}
          </button>
          <div className="flex gap-2">
            {step < 3 ? (
              <button
                onClick={() => {
                  if (step === 1 && (!name.trim() || !templateName.trim())) {
                    toast.error("Preencha nome e template");
                    return;
                  }
                  if (step === 2 && selectedIds.size === 0) {
                    toast.error("Selecione pelo menos 1 contato");
                    return;
                  }
                  setStep(step + 1);
                }}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                Próximo
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {saving ? "Criando..." : "Criar Campanha"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

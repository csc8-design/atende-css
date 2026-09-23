import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Bot, Settings2, Save, X, MessageSquare, Zap, Search, Home, GitBranch, Play, Pause, ChevronRight, ChevronLeft, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ChatbotFlowDiagram from "@/components/chatbot/ChatbotFlowDiagram";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface MenuOption {
  text: string;
  action: string; // "jump_menu" | "transfer_dept" | "close" | "message"
  target_menu_id?: string;
  target_dept_id?: string;
}

interface ChatbotConfig {
  id: string;
  name: string;
  description: string | null;
  department_id: string | null;
  system_prompt: string;
  model: string;
  welcome_message: string | null;
  is_active: boolean;
  max_tokens: number;
  temperature: number;
  auto_transfer_to_agent: boolean;
  transfer_keywords: string[];
  menu_options: MenuOption[];
  created_at: string;
  departments?: { name: string } | null;
}

interface Department {
  id: string;
  name: string;
}

const availableModels = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (Rápido)", description: "Melhor custo-benefício" },
  { value: "google/gemini-3-pro-preview", label: "Gemini 3 Pro (Avançado)", description: "Mais preciso e capaz" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Rápido e eficiente" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Alta qualidade" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", description: "Bom equilíbrio" },
  { value: "openai/gpt-5", label: "GPT-5", description: "Máxima qualidade" },
];

const ChatbotSettings = () => {
  const [configs, setConfigs] = useState<ChatbotConfig[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [editConfig, setEditConfig] = useState<ChatbotConfig | null>(null);
  const [deleteConfig, setDeleteConfig] = useState<ChatbotConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [chatbotEnabled, setChatbotEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [inactivityDialog, setInactivityDialog] = useState(false);
  const [diagramDialog, setDiagramDialog] = useState(false);
  const [inactEnabled, setInactEnabled] = useState(false);
  const [inactTime, setInactTime] = useState("5");
  const [inactAction, setInactAction] = useState("transfer_dept");
  const [inactDept, setInactDept] = useState("none");

  // Edit form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDepartmentId, setFormDepartmentId] = useState<string>("none");
  const [formSystemPrompt, setFormSystemPrompt] = useState("");
  const [formModel, setFormModel] = useState("google/gemini-3-flash-preview");
  const [formWelcome, setFormWelcome] = useState("");
  const [formMaxTokens, setFormMaxTokens] = useState(1024);
  const [formTemperature, setFormTemperature] = useState(0.7);
  const [formAutoTransfer, setFormAutoTransfer] = useState(true);
  const [formKeywords, setFormKeywords] = useState("");
  const [formFormat, setFormFormat] = useState("options"); // options | text | external
  const [formPreferButtons, setFormPreferButtons] = useState(false);
  const [formMenuOptions, setFormMenuOptions] = useState<MenuOption[]>([]);

  // Test chat
  const [testMessage, setTestMessage] = useState("");
  const [testHistory, setTestHistory] = useState<{ role: string; content: string }[]>([]);
  const [testLoading, setTestLoading] = useState(false);

  const fetchConfigs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("chatbot_configs")
      .select("*, departments(name)")
      .order("created_at", { ascending: false });
    setConfigs((data as any) || []);
    if (data && data.length > 0) {
      setChatbotEnabled(data.some((c: any) => c.is_active));
    }
    setLoading(false);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase.from("departments").select("id, name").eq("is_active", true);
    setDepartments(data || []);
  };

  useEffect(() => {
    fetchConfigs();
    fetchDepartments();
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormDepartmentId("none");
    setFormSystemPrompt("Você é um assistente virtual. Seja educado, objetivo e ajude o cliente com suas dúvidas.");
    setFormModel("google/gemini-3-flash-preview");
    setFormWelcome("Olá! 👋 Como posso ajudá-lo?");
    setFormMaxTokens(1024);
    setFormTemperature(0.7);
    setFormAutoTransfer(true);
    setFormKeywords("atendente, humano, pessoa, agente");
    setFormFormat("options");
    setFormPreferButtons(false);
    setFormMenuOptions([]);
    setTestHistory([]);
  };

  const openEdit = (config: ChatbotConfig) => {
    setEditConfig(config);
    setFormName(config.name);
    setFormDescription(config.description || "");
    setFormDepartmentId(config.department_id || "none");
    setFormSystemPrompt(config.system_prompt);
    setFormModel(config.model);
    setFormWelcome(config.welcome_message || "");
    setFormMaxTokens(config.max_tokens);
    setFormTemperature(config.temperature);
    setFormAutoTransfer(config.auto_transfer_to_agent);
    setFormKeywords((config.transfer_keywords || []).join(", "));
    setFormMenuOptions((config.menu_options as MenuOption[]) || []);
    setFormFormat((config.menu_options as MenuOption[])?.length > 0 ? "options" : "text");
    setFormPreferButtons(false);
    setTestHistory([]);
    setShowNew(false);
  };

  const openNew = () => {
    resetForm();
    setEditConfig(null);
    setShowNew(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    const payload = {
      name: formName,
      description: formDescription || null,
      department_id: formDepartmentId === "none" ? null : formDepartmentId,
      system_prompt: formSystemPrompt,
      model: formModel,
      welcome_message: formWelcome || null,
      max_tokens: formMaxTokens,
      temperature: formTemperature,
      auto_transfer_to_agent: formAutoTransfer,
      transfer_keywords: formKeywords.split(",").map((k) => k.trim()).filter(Boolean),
      menu_options: JSON.parse(JSON.stringify(formMenuOptions)),
    };

    try {
      if (editConfig) {
        const { error } = await supabase.from("chatbot_configs").update(payload).eq("id", editConfig.id);
        if (error) throw error;
        toast.success("Chatbot atualizado");
      } else {
        const { error } = await supabase.from("chatbot_configs").insert(payload);
        if (error) throw error;
        toast.success("Chatbot criado");
      }
      setEditConfig(null);
      setShowNew(false);
      fetchConfigs();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAll = async () => {
    const newState = !chatbotEnabled;
    setChatbotEnabled(newState);
    for (const c of configs) {
      await supabase.from("chatbot_configs").update({ is_active: newState }).eq("id", c.id);
    }
    toast.success(newState ? "Chatbot ativado" : "Chatbot desativado");
    fetchConfigs();
  };

  const handleDelete = async () => {
    if (!deleteConfig) return;
    const { error } = await supabase.from("chatbot_configs").delete().eq("id", deleteConfig.id);
    if (error) {
      toast.error("Erro ao excluir");
    } else {
      toast.success("Chatbot excluído");
      setDeleteConfig(null);
      fetchConfigs();
    }
  };

  const handleTestChat = async (configId: string) => {
    if (!testMessage.trim()) return;
    const userMsg = { role: "user" as const, content: testMessage };
    setTestHistory((prev) => [...prev, userMsg]);
    setTestMessage("");
    setTestLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("chatbot-ai", {
        body: { chatbotId: configId, message: testMessage, conversationHistory: testHistory },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTestHistory((prev) => [
        ...prev,
        { role: "assistant", content: data.reply + (data.transfer ? "\n\n🔄 *Transferência solicitada*" : "") },
      ]);
    } catch (err: any) {
      toast.error(err.message || "Erro no teste");
      setTestHistory((prev) => [...prev, { role: "assistant", content: "❌ Erro ao processar" }]);
    } finally {
      setTestLoading(false);
    }
  };

  const isEditing = editConfig || showNew;
  const currentConfigId = editConfig?.id;

  const filteredConfigs = configs.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isEditing) {
    const addMenuOption = () => {
      setFormMenuOptions((prev) => [...prev, { text: "", action: "jump_menu", target_menu_id: "" }]);
    };

    const updateMenuOption = (idx: number, field: keyof MenuOption, value: string) => {
      setFormMenuOptions((prev) => prev.map((opt, i) => i === idx ? { ...opt, [field]: value } : opt));
    };

    const removeMenuOption = (idx: number) => {
      setFormMenuOptions((prev) => prev.filter((_, i) => i !== idx));
    };

    const otherMenus = configs.filter((c) => c.id !== editConfig?.id);

    return (
      <div className="max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chatbot</h1>
          <p className="text-sm text-muted-foreground mt-1">
            O chatbot realiza pré-atendimentos automaticamente. Após o processo, o chatbot direciona o atendimento a um departamento ou até mesmo finaliza o atendimento.
          </p>
        </div>

        {/* Back + Save + Delete */}
        <div className="flex items-center justify-between">
          <button onClick={() => { setEditConfig(null); setShowNew(false); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" /> voltar
          </button>
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" /> {saving ? "salvando..." : "salvar"}
            </Button>
            {editConfig && (
              <Button variant="outline" size="icon" onClick={() => setDeleteConfig(editConfig)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Identificador */}
        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-foreground">Identificador</Label>
          <p className="text-xs text-muted-foreground">Um título que identifique o menu. Não é enviado ao cliente.</p>
          <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Menu Inicial" className="bg-card" />
        </div>

        {/* Mensagem do menu */}
        <div className="space-y-2">
          <Label className="text-sm font-bold text-foreground">Mensagem do menu</Label>
          <p className="text-xs text-muted-foreground">Mensagem enviada quando este menu é acionado.</p>
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Texto</span>
              <Textarea value={formWelcome} onChange={(e) => setFormWelcome(e.target.value)} rows={3} placeholder="Olá! 😊 Tudo bem? Como posso te ajudar hoje?" className="bg-secondary/50" />
            </div>
          </div>
        </div>

        {/* Formato */}
        <div className="space-y-3">
          <Label className="text-sm font-bold text-foreground">Formato</Label>
          <RadioGroup value={formFormat} onValueChange={setFormFormat} className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="options" id="fmt-options" />
              <label htmlFor="fmt-options" className="text-sm text-foreground cursor-pointer">Opções pré-definidas</label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="text" id="fmt-text" />
              <label htmlFor="fmt-text" className="text-sm text-foreground cursor-pointer">Texto</label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="external" id="fmt-ext" />
              <label htmlFor="fmt-ext" className="text-sm text-foreground cursor-pointer">Requisição externa</label>
            </div>
          </RadioGroup>
        </div>

        {/* Formato de menu */}
        {formFormat === "options" && (
          <>
            <div className="space-y-2">
              <Label className="text-sm font-bold text-foreground">Formato de menu</Label>
              <div className="flex items-center gap-3">
                <Switch checked={formPreferButtons} onCheckedChange={setFormPreferButtons} />
                <span className="text-sm text-foreground">Preferir botões ou listas</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Para utilizar este recurso, certifique-se que o texto das opções contém no <strong>máximo 20 caracteres</strong>. O Recurso está disponível para os provedores WhatsApp Oficial e Facebook Messenger.
              </p>
            </div>

            {/* Opções do menu */}
            <div className="space-y-3">
              <Label className="text-sm font-bold text-foreground">Opções do menu</Label>

              {formMenuOptions.map((opt, idx) => (
                <div key={idx} className="bg-card border border-border rounded-lg p-4 space-y-3 relative">
                  <button onClick={() => removeMenuOption(idx)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col gap-1 pt-2">
                      <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Texto</span>
                        <Input value={opt.text} onChange={(e) => updateMenuOption(idx, "text", e.target.value)} placeholder="Comercial" className="bg-secondary/50" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Ação</span>
                        <Select value={opt.action} onValueChange={(v) => updateMenuOption(idx, "action", v)}>
                          <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="jump_menu">Saltar para menu</SelectItem>
                            <SelectItem value="transfer_dept">Transferir para departamento</SelectItem>
                            <SelectItem value="close">Finalizar atendimento</SelectItem>
                            <SelectItem value="message">Enviar mensagem</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {opt.action === "jump_menu" && (
                    <div className="ml-6 space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">Saltar para menu</span>
                      <Select value={opt.target_menu_id || "none"} onValueChange={(v) => updateMenuOption(idx, "target_menu_id", v)}>
                        <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Selecione um menu" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" disabled>Selecione um menu</SelectItem>
                          {otherMenus.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {opt.action === "transfer_dept" && (
                    <div className="ml-6 space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">Departamento</span>
                      <Select value={opt.target_dept_id || "none"} onValueChange={(v) => updateMenuOption(idx, "target_dept_id", v)}>
                        <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Selecione um departamento" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" disabled>Selecione um departamento</SelectItem>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ))}

              <Button variant="outline" onClick={addMenuOption} className="gap-2">
                <Plus className="w-4 h-4" /> Adicionar opção
              </Button>
            </div>
          </>
        )}

        {/* IA Settings (collapsible) */}
        <details className="bg-card border border-border rounded-xl overflow-hidden">
          <summary className="px-5 py-4 cursor-pointer text-sm font-bold text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> Configurações de IA
          </summary>
          <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
            <div className="space-y-2">
              <Label>Modelo de IA</Label>
              <Select value={formModel} onValueChange={setFormModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableModels.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <span>{m.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prompt do Sistema</Label>
              <Textarea value={formSystemPrompt} onChange={(e) => setFormSystemPrompt(e.target.value)} rows={6} className="font-mono text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tokens máximos: {formMaxTokens}</Label>
                <Slider value={[formMaxTokens]} onValueChange={([v]) => setFormMaxTokens(v)} min={256} max={4096} step={128} />
              </div>
              <div className="space-y-2">
                <Label>Temperatura: {formTemperature.toFixed(2)}</Label>
                <Slider value={[formTemperature * 100]} onValueChange={([v]) => setFormTemperature(v / 100)} min={0} max={100} step={5} />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <div>
                <Label className="text-sm">Transferir para atendente automaticamente</Label>
                <p className="text-xs text-muted-foreground">Quando o cliente solicitar atendimento humano</p>
              </div>
              <Switch checked={formAutoTransfer} onCheckedChange={setFormAutoTransfer} />
            </div>
            {formAutoTransfer && (
              <div className="space-y-2">
                <Label>Palavras-chave de transferência</Label>
                <Input value={formKeywords} onChange={(e) => setFormKeywords(e.target.value)} placeholder="atendente, humano, pessoa" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={formDepartmentId} onValueChange={setFormDepartmentId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Todos os departamentos</SelectItem>
                  {departments.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Chatbot</h1>
        <p className="text-sm text-muted-foreground mt-1">
          O chatbot realiza pré-atendimentos automaticamente. Após o processo, o chatbot direciona o atendimento a um departamento ou até mesmo finaliza o atendimento.
        </p>
      </div>

      {/* Top cards */}
      <div className="space-y-3">
        {/* Ativar Chatbot */}
        <div className="flex items-center justify-between bg-card border border-border rounded-xl px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Ativar Chatbot</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Ativar Chatbot para atendimento automático.</p>
          </div>
          <Switch checked={chatbotEnabled} onCheckedChange={handleToggleAll} />
        </div>

        {/* Ação de Inatividade */}
        <div className="flex items-center justify-between bg-card border border-border rounded-xl px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Ação de Inatividade</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Defina uma ação do chatbot para casos de inatividade.</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => setInactivityDialog(true)}>
            <Settings2 className="w-4 h-4" />
            Configurar
          </Button>
        </div>

        {/* Diagrama */}
        <div className="flex items-center justify-between bg-card border border-border rounded-xl px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Diagrama</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Visualize o fluxo completo do chatbot em formato de diagrama interativo.</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => setDiagramDialog(true)}>
            <GitBranch className="w-4 h-4" />
            Visualizar
          </Button>
        </div>
      </div>

      {/* Search + Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Pesquisar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 transition-shadow text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Adicionar
        </Button>
      </div>

      {/* Menu table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-semibold text-primary uppercase tracking-wider">Identificador</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Menu inicial</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ação</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-sm text-muted-foreground">Carregando...</td>
              </tr>
            ) : filteredConfigs.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Nenhum chatbot encontrado
                </td>
              </tr>
            ) : (
              filteredConfigs.map((config, idx) => (
                <tr key={config.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-semibold text-foreground">{config.name}</span>
                    {config.departments?.name && (
                      <span className="ml-2 text-xs text-muted-foreground">({config.departments.name})</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <Home className={`w-5 h-5 mx-auto ${config.is_active ? "text-primary" : "text-muted-foreground"}`} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => openEdit(config)}
                      className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Editar <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Inactivity Dialog */}
      <Dialog open={inactivityDialog} onOpenChange={setInactivityDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar ação de inatividade</DialogTitle>
          </DialogHeader>

          <div className="flex justify-end">
            <Button onClick={() => { toast.success("Configuração salva"); setInactivityDialog(false); }} className="gap-2">
              <Save className="w-4 h-4" />
              Salvar
            </Button>
          </div>

          <div className="space-y-6 pt-2">
            <div className="flex items-center gap-3">
              <Switch checked={inactEnabled} onCheckedChange={setInactEnabled} />
              <span className="text-sm text-foreground">Ativar</span>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Tempo de inatividade</Label>
              <Select value={inactTime} onValueChange={setInactTime}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 minuto</SelectItem>
                  <SelectItem value="3">3 minutos</SelectItem>
                  <SelectItem value="5">5 minutos</SelectItem>
                  <SelectItem value="10">10 minutos</SelectItem>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Tipo de Ação</Label>
              <Select value={inactAction} onValueChange={setInactAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer_dept">Transferir para departamento</SelectItem>
                  <SelectItem value="transfer_agent">Transferir para agente</SelectItem>
                  <SelectItem value="close">Finalizar atendimento</SelectItem>
                  <SelectItem value="message">Enviar mensagem de lembrete</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {inactAction === "transfer_dept" && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">Departamento para transferir</Label>
                <Select value={inactDept} onValueChange={setInactDept}>
                  <SelectTrigger><SelectValue placeholder="Escolha um departamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Escolha um departamento</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diagram Dialog */}
      <Dialog open={diagramDialog} onOpenChange={setDiagramDialog}>
        <DialogContent className="max-w-[90vw] max-h-[85vh] w-full">
          <DialogHeader>
            <DialogTitle>Diagrama do Chatbot</DialogTitle>
            <DialogDescription>Fluxo completo de atendimento do chatbot</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border h-[65vh] overflow-hidden">
            {diagramDialog && <ChatbotFlowDiagram />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiagramDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfig} onOpenChange={(open) => !open && setDeleteConfig(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Chatbot</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deleteConfig?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfig(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatbotSettings;

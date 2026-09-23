import { Save, Brain, Sparkles, MessageSquare, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useEffect, useState } from "react";

const aiFeatures = [
  { key: "ai_auto_responses", title: "Respostas Automáticas", desc: "IA responde automaticamente baseado no contexto" },
  { key: "ai_lead_classification", title: "Classificação de Leads", desc: "Classifica automaticamente leads por potencial" },
  { key: "ai_sentiment_analysis", title: "Análise de Sentimento", desc: "Detecta o humor do cliente durante a conversa" },
  { key: "ai_response_suggestions", title: "Sugestão de Respostas", desc: "Sugere respostas para o atendente em tempo real" },
  { key: "ai_conversation_summary", title: "Resumo de Conversa", desc: "Gera resumos automáticos das conversas" },
];

const AISettings = () => {
  const { settings, loading, saving, updateSetting, saveAll } = useSystemSettings();

  const [localFeatures, setLocalFeatures] = useState<Record<string, boolean>>({});
  const [assistantName, setAssistantName] = useState("Assistente Virtual");
  const [voiceTone, setVoiceTone] = useState("Profissional e amigável");
  const [customInstructions, setCustomInstructions] = useState(
    "Seja sempre educado e prestativo. Responda de forma clara e objetiva. Quando não souber a resposta, encaminhe para um atendente humano."
  );
  const [aiProvider, setAiProvider] = useState("OpenAI (GPT-4)");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (!loading) {
      const features: Record<string, boolean> = {};
      for (const f of aiFeatures) {
        features[f.key] = settings[f.key] === true || settings[f.key] === undefined && (f.key === "ai_auto_responses" || f.key === "ai_lead_classification" || f.key === "ai_response_suggestions");
      }
      setLocalFeatures(features);
      if (settings.ai_assistant_name) setAssistantName(settings.ai_assistant_name as string);
      if (settings.ai_voice_tone) setVoiceTone(settings.ai_voice_tone as string);
      if (settings.ai_custom_instructions) setCustomInstructions(settings.ai_custom_instructions as string);
      if (settings.ai_provider) setAiProvider(settings.ai_provider as string);
    }
  }, [loading, settings]);

  const toggleFeature = (key: string) => {
    setLocalFeatures(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    const toSave: Record<string, any> = { ...localFeatures };
    toSave.ai_assistant_name = assistantName;
    toSave.ai_voice_tone = voiceTone;
    toSave.ai_custom_instructions = customInstructions;
    toSave.ai_provider = aiProvider;
    if (apiKey) toSave.ai_api_key = apiKey;
    for (const [k, v] of Object.entries(toSave)) {
      updateSetting(k, v);
    }
    saveAll(toSave);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inteligência Artificial</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure a IA para otimizar seu atendimento</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          Recursos de IA
        </h3>

        {aiFeatures.map((feature) => (
          <div key={feature.key} className="flex items-center justify-between py-2">
            <div>
              <span className="text-sm font-medium text-foreground">{feature.title}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{feature.desc}</p>
            </div>
            <Switch
              checked={!!localFeatures[feature.key]}
              onCheckedChange={() => toggleFeature(feature.key)}
            />
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Personalidade da IA
        </h3>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Nome do assistente</label>
          <input className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground" value={assistantName} onChange={e => setAssistantName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Tom de voz</label>
          <select className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground" value={voiceTone} onChange={e => setVoiceTone(e.target.value)}>
            <option>Profissional e amigável</option>
            <option>Formal</option>
            <option>Casual e descontraído</option>
            <option>Técnico e objetivo</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Instruções personalizadas</label>
          <textarea
            rows={4}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground resize-none"
            value={customInstructions}
            onChange={e => setCustomInstructions(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          Configuração da API
        </h3>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Provedor de IA</label>
          <select className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground" value={aiProvider} onChange={e => setAiProvider(e.target.value)}>
            <option>OpenAI (GPT-4)</option>
            <option>Anthropic (Claude)</option>
            <option>Google (Gemini)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">API Key</label>
          <input
            type="password"
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
            placeholder="sk-..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salvar Configurações
      </button>
    </div>
  );
};

export default AISettings;

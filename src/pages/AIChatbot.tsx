import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Brain, CreditCard, MessageSquare, TrendingUp, Send, DollarSign, AlertTriangle, Info } from "lucide-react";
import ChatbotSettings from "@/pages/settings/ChatbotSettings";
import { supabase } from "@/integrations/supabase/client";

interface MetaUsageStats {
  totalConversations: number;
  messagesSent: number;
  messagesReceived: number;
  templatesSent: number;
  freeConversations: number;
  paidConversations: number;
  estimatedCost: number;
}

const META_PRICING = {
  marketing: 0.0625, // USD per conversation (Brazil)
  utility: 0.0080,
  service: 0.0300,
  authentication: 0.0340,
  freeEntryPoints: 0, // free-tier click-to-whatsapp / free entry points
};

const AIChatbotPage = () => {
  const [metaStats, setMetaStats] = useState<MetaUsageStats>({
    totalConversations: 0,
    messagesSent: 0,
    messagesReceived: 0,
    templatesSent: 0,
    freeConversations: 0,
    paidConversations: 0,
    estimatedCost: 0,
  });
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetaUsage();
  }, [period]);

  const fetchMetaUsage = async () => {
    setLoading(true);
    const now = new Date();
    const start = new Date(now);
    if (period === "7d") start.setDate(start.getDate() - 7);
    else if (period === "30d") start.setDate(start.getDate() - 30);
    else start.setDate(start.getDate() - 90);

    const startISO = start.toISOString();

    // Count conversations initiated in period
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, channel, status, created_at")
      .gte("created_at", startISO)
      .eq("channel", "whatsapp");

    const conversations = convs || [];

    // Count messages sent by agents (outbound = costs money)
    const { data: sentMsgs } = await supabase
      .from("messages")
      .select("id, sender_type, message_type, created_at")
      .gte("created_at", startISO)
      .eq("sender_type", "agent");

    const agentMessages = sentMsgs || [];

    // Count messages received from contacts
    const { data: receivedMsgs } = await supabase
      .from("messages")
      .select("id, created_at")
      .gte("created_at", startISO)
      .eq("sender_type", "contact");

    // Count campaign sends (template messages)
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("sent_count, template_category")
      .gte("created_at", startISO);

    const totalTemplateSent = (campaigns || []).reduce((s, c) => s + (c.sent_count || 0), 0);

    // Meta pricing: first 1000 service conversations/month are free
    // Marketing/utility/auth conversations cost per conversation
    const totalConvs = conversations.length;
    const freeConvs = Math.min(totalConvs, 1000); // Meta gives 1000 free service conversations
    const paidConvs = Math.max(0, totalConvs - 1000);

    // Estimate cost: service conversations + marketing templates
    const serviceCost = paidConvs * META_PRICING.service;
    const marketingCost = totalTemplateSent * META_PRICING.marketing;
    const estimatedCost = serviceCost + marketingCost;

    setMetaStats({
      totalConversations: totalConvs,
      messagesSent: agentMessages.length,
      messagesReceived: (receivedMsgs || []).length,
      templatesSent: totalTemplateSent,
      freeConversations: freeConvs,
      paidConversations: paidConvs,
      estimatedCost: Number(estimatedCost.toFixed(2)),
    });
    setLoading(false);
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">IA & Chatbot</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie o chatbot, configurações de IA e acompanhe custos com a Meta
          </p>
        </div>

        <Tabs defaultValue="chatbot" className="space-y-6">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="chatbot" className="gap-2">
              <Bot className="w-4 h-4" /> Chatbot
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-2">
              <CreditCard className="w-4 h-4" /> Custos Meta
            </TabsTrigger>
          </TabsList>

          {/* Chatbot Tab - reuses existing ChatbotSettings */}
          <TabsContent value="chatbot">
            <ChatbotSettings />
          </TabsContent>

          {/* Meta Usage / Costs Tab */}
          <TabsContent value="usage" className="space-y-6">
            {/* Meta compliance notice */}
            <div className="flex gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm text-foreground">
                <p className="font-semibold mb-1">Modelo de Preços da Meta (WhatsApp Business API)</p>
                <ul className="text-muted-foreground space-y-1 text-xs list-disc ml-4">
                  <li><strong>1.000 conversas de serviço gratuitas</strong> por mês</li>
                  <li>Conversas de serviço (cliente inicia): <strong>US$ 0,03</strong> cada</li>
                  <li>Conversas de marketing (templates): <strong>US$ 0,0625</strong> cada</li>
                  <li>Conversas de utilidade: <strong>US$ 0,008</strong> cada</li>
                  <li>Janela de 24h: mensagens livres após resposta do cliente</li>
                </ul>
              </div>
            </div>

            {/* Period selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Período:</span>
              {(["7d", "30d", "90d"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    period === p
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias"}
                </button>
              ))}
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <MessageSquare className="w-5 h-5 text-primary mb-2" />
                <p className="text-2xl font-bold text-foreground">{metaStats.totalConversations}</p>
                <p className="text-xs text-muted-foreground">Conversas WhatsApp</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <Send className="w-5 h-5 text-primary mb-2" />
                <p className="text-2xl font-bold text-foreground">{metaStats.messagesSent}</p>
                <p className="text-xs text-muted-foreground">Mensagens Enviadas</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <TrendingUp className="w-5 h-5 text-primary mb-2" />
                <p className="text-2xl font-bold text-foreground">{metaStats.templatesSent}</p>
                <p className="text-xs text-muted-foreground">Templates Enviados</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <DollarSign className="w-5 h-5 text-warning mb-2" />
                <p className="text-2xl font-bold text-foreground">US$ {metaStats.estimatedCost.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Custo Estimado</p>
              </div>
            </div>

            {/* Detailed breakdown */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
              <h3 className="font-semibold text-foreground">Detalhamento de Custos</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Tipo</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Quantidade</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Preço Unit.</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="px-4 py-3 text-sm text-foreground">Conversas gratuitas (serviço)</td>
                    <td className="px-4 py-3 text-sm text-success font-medium">{metaStats.freeConversations}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">US$ 0,00</td>
                    <td className="px-4 py-3 text-sm text-success font-medium">US$ 0,00</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="px-4 py-3 text-sm text-foreground">Conversas pagas (serviço)</td>
                    <td className="px-4 py-3 text-sm text-foreground">{metaStats.paidConversations}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">US$ 0,03</td>
                    <td className="px-4 py-3 text-sm text-foreground">US$ {(metaStats.paidConversations * META_PRICING.service).toFixed(2)}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="px-4 py-3 text-sm text-foreground">Templates marketing</td>
                    <td className="px-4 py-3 text-sm text-foreground">{metaStats.templatesSent}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">US$ 0,0625</td>
                    <td className="px-4 py-3 text-sm text-foreground">US$ {(metaStats.templatesSent * META_PRICING.marketing).toFixed(2)}</td>
                  </tr>
                  <tr className="border-t-2 border-border">
                    <td className="px-4 py-3 text-sm font-bold text-foreground" colSpan={3}>Total Estimado</td>
                    <td className="px-4 py-3 text-sm font-bold text-primary">US$ {metaStats.estimatedCost.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Recommendations */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                Dicas para Reduzir Custos
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  Use a <strong>janela de 24h</strong>: após o cliente enviar mensagem, você pode responder livremente por 24h sem custo extra.
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  Prefira templates de <strong>utilidade</strong> (US$ 0,008) em vez de marketing (US$ 0,0625) quando possível.
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  Aproveite as <strong>1.000 conversas gratuitas</strong> mensais de serviço.
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  Use <strong>pontos de entrada gratuitos</strong> (anúncios click-to-WhatsApp) para conversas sem custo.
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  Mantenha a <strong>qualidade do número</strong> alta para evitar restrições de envio.
                </li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AIChatbotPage;

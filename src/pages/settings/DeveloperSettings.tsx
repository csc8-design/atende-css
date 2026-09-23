import { Copy, Key, RefreshCw, ExternalLink } from "lucide-react";

const DeveloperSettings = () => {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Desenvolvedor</h1>
        <p className="text-sm text-muted-foreground mt-1">API Keys, webhooks e integrações técnicas</p>
      </div>

      {/* API Keys */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          Chaves de API
        </h3>
        {[
          { name: "Produção", key: "ap_live_xxxxxxxxxxxxxxxxxxxx", created: "15/01/2024" },
          { name: "Teste", key: "ap_test_xxxxxxxxxxxxxxxxxxxx", created: "15/01/2024" },
        ].map((apiKey) => (
          <div key={apiKey.name} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
            <div>
              <p className="text-sm font-medium text-foreground">{apiKey.name}</p>
              <code className="text-xs text-muted-foreground font-mono">{apiKey.key}</code>
              <p className="text-[10px] text-muted-foreground mt-0.5">Criada em {apiKey.created}</p>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
                <Copy className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Webhooks */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Webhooks</h3>
          <button className="text-sm text-primary font-medium hover:underline">+ Adicionar</button>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">URL do Webhook</label>
          <input className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground" placeholder="https://seusite.com/webhook" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Eventos</label>
          <div className="grid grid-cols-2 gap-2">
            {["message.received", "message.sent", "conversation.created", "conversation.closed", "contact.created", "contact.updated"].map((event) => (
              <label key={event} className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" className="rounded border-border text-primary" defaultChecked={event.includes("message")} />
                <code className="text-xs font-mono">{event}</code>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Documentation */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-2">Documentação da API</h3>
        <p className="text-sm text-muted-foreground mb-3">Acesse a documentação completa da API REST para integrar com seus sistemas.</p>
        <button className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
          <ExternalLink className="w-4 h-4" />
          Ver Documentação
        </button>
      </div>
    </div>
  );
};

export default DeveloperSettings;

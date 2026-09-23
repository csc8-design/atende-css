import { Copy, Plus, ExternalLink, Code2 } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";

const WidgetsSettings = () => {
  const { branding } = useBranding();
  const embedCode = `<script src="https://widget.example.com/widget.js" data-id="abc123"></script>`;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Widgets</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure widgets de chat para seu site</p>
      </div>

      {/* Widget Preview Card */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-foreground">Widget de Chat ao Vivo</h3>
        <div className="flex gap-6">
          {/* Preview */}
          <div className="w-64 h-80 bg-background rounded-xl border border-border p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">{branding.platform_name.slice(0, 2).toUpperCase()}</div>
              <div>
                <p className="text-xs font-semibold text-foreground">{branding.platform_name}</p>
                <p className="text-[10px] text-success">● Online</p>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <div className="bg-secondary rounded-lg p-2 max-w-[80%]">
                <p className="text-[11px] text-foreground">Olá! Como posso ajudar?</p>
              </div>
            </div>
            <div className="bg-secondary rounded-lg px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Digite sua mensagem...</p>
            </div>
          </div>

          {/* Config */}
          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Cor do Widget</label>
              <div className="flex gap-2">
                {["#10b981", "#3b82f6", "#ef4444", "#8b5cf6", "#f59e0b", "#000000"].map((color) => (
                  <button
                    key={color}
                    className="w-8 h-8 rounded-full border-2 border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Posição</label>
              <select className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none text-foreground">
                <option>Inferior Direito</option>
                <option>Inferior Esquerdo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Mensagem de boas-vindas</label>
              <input className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none text-foreground" defaultValue="Olá! Como posso ajudar?" />
            </div>
          </div>
        </div>
      </div>

      {/* Embed Code */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" />
          Código de Incorporação
        </h3>
        <div className="relative">
          <pre className="bg-background rounded-lg p-4 text-xs text-foreground font-mono overflow-x-auto border border-border">
            {embedCode}
          </pre>
          <button className="absolute top-2 right-2 p-1.5 rounded-lg bg-secondary hover:bg-muted transition-colors">
            <Copy className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Cole este código antes do fechamento da tag &lt;/body&gt; do seu site.</p>
      </div>
    </div>
  );
};

export default WidgetsSettings;

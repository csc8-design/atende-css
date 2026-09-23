import { useState } from "react";
import { Save, RotateCcw, Upload, Trash2, Settings2, Info, Lock, Sun, Moon, Monitor, Palette } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme, type ThemeMode, ACCENT_COLORS } from "@/hooks/useTheme";

const GeneralSettings = () => {
  const { settings, loading, saving, updateSetting, saveAll } = useSystemSettings();
  const { theme, setTheme, accentColor, setAccentColor } = useTheme();
  const [autoDistDialog, setAutoDistDialog] = useState(false);
  const [autoCloseDialog, setAutoCloseDialog] = useState(false);
  const [businessHoursDialog, setBusinessHoursDialog] = useState(false);

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4 p-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const get = (key: string, fallback: any = "") => settings[key] ?? fallback;
  const set = (key: string, value: any) => updateSetting(key, value);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ajustes gerais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Os principais ajustes do sistema estão aqui. Mensagens boas vindas/finalização, regras de utilização, horário de atendimento e mais.
          </p>
        </div>
        <Button
          onClick={() => saveAll(settings)}
          disabled={saving}
          className="flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      {/* Settings rows */}
      <div className="space-y-1">
        {/* Versão */}
        <SettingRow
          title="Versão"
          description=""
          right={
            <div className="text-right">
              <span className="text-sm font-mono text-foreground">v1.0.0</span>
              <p className="text-xs text-muted-foreground">{new Date().toISOString()}</p>
            </div>
          }
        />

        {/* Reiniciar instância */}
        <SettingRow
          title="Reiniciar instância"
          description="Reinicie sua instância para corrigir erros automaticamente. Será necessário ler um novo QR Code (WhatsApp)."
          right={
            <Button variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Reiniciar
            </Button>
          }
        />

        {/* Nome da instância */}
        <SettingRow
          title="Nome da instância"
          description="Um nome que identifique sua empresa (não é exibido para seus clientes)."
          right={
            <Input
              className="w-64"
              value={get("instance_name", "")}
              onChange={(e) => set("instance_name", e.target.value)}
            />
          }
        />

        {/* Logotipo */}
        <SettingRow
          title="Logotipo"
          description="Personalize a plataforma com seu próprio logotipo."
          right={
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Buscar...
              </Button>
              <Button variant="ghost" size="icon">
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          }
        />

        {/* Tema do sistema */}
        <SettingRow
          title="Tema do sistema"
          description="Escolha entre tema escuro, claro ou automático (segue a preferência do sistema)."
          right={
            <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
              {([
                { value: "dark" as ThemeMode, icon: Moon, label: "Escuro" },
                { value: "light" as ThemeMode, icon: Sun, label: "Claro" },
                { value: "auto" as ThemeMode, icon: Monitor, label: "Auto" },
              ]).map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    theme === value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          }
        />

        {/* Cor de destaque */}
        <SettingRow
          title={
            <span className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Cor da plataforma
            </span>
          }
          description="Escolha a cor de destaque principal da interface."
          right={
            <div className="flex items-center gap-2 flex-wrap max-w-[280px] justify-end">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => setAccentColor(color.name)}
                  title={color.label}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    accentColor === color.name
                      ? "border-foreground scale-110 shadow-md"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: `hsl(${color.hsl})` }}
                />
              ))}
            </div>
          }
        />

        {/* Mensagem de boas vindas */}
        <SettingRow
          title="Mensagem de boas vindas"
          description="Mensagem automática enviada sempre que um cliente iniciar uma conversa com você."
          right={
            <Textarea
              className="w-64 min-h-[60px] text-sm"
              value={get("welcome_message", "")}
              onChange={(e) => set("welcome_message", e.target.value)}
            />
          }
        />

        {/* Mensagem de finalização */}
        <SettingRow
          title="Mensagem de finalização"
          description="Mensagem automática enviada sempre que um atendimento for finalizado."
          descriptionExtra={
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Info className="w-3 h-3" />
              As mensagens definidas nos Motivos de Finalização sobrepõem esta configuração.
            </p>
          }
          right={
            <Textarea
              className="w-64 min-h-[60px] text-sm"
              value={get("closing_message", "")}
              onChange={(e) => set("closing_message", e.target.value)}
            />
          }
        />

        {/* Avaliação de atendimento */}
        <SettingRow
          title="Avaliação de atendimento"
          description="Após finalizar um atendimento, envia uma mensagem automática solicitando que o cliente dê uma nota entre 1 e 5."
          right={
            <Switch
              checked={get("satisfaction_rating_enabled", true)}
              onCheckedChange={(v) => set("satisfaction_rating_enabled", v)}
            />
          }
        />

        {/* Distribuição Automática */}
        <SettingRow
          title="Distribuição Automática (Beta)"
          description="Defina se as mensagens devem ser distribuídas automaticamente e os intervalos de redistribuição."
          right={
            <div className="flex items-center gap-3">
              <Switch
                checked={get("auto_distribution_enabled", false)}
                onCheckedChange={(v) => set("auto_distribution_enabled", v)}
              />
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAutoDistDialog(true)}>
                <Settings2 className="w-3.5 h-3.5" />
                Configurar
              </Button>
            </div>
          }
        />

        {/* Usuário padrão (carteirização) */}
        <SettingRow
          title="Usuário padrão (carteirização)"
          description="Permite designar um usuário padrão para um contato. Quando o contato iniciar um atendimento, ele ficará acessível exclusivamente para esse usuário."
          right={
            <div className="space-y-2">
              <Switch
                checked={get("default_user_enabled", true)}
                onCheckedChange={(v) => set("default_user_enabled", v)}
              />
              {get("default_user_enabled", true) && (
                <Input
                  className="w-64 text-sm"
                  value={get("default_user_message", "")}
                  onChange={(e) => set("default_user_message", e.target.value)}
                  placeholder="Mensagem de espera..."
                />
              )}
            </div>
          }
        />

        {/* Identificar nome do usuário */}
        <SettingRow
          title="Identificar nome do usuário"
          description="Inclui o nome do usuário nas mensagens enviadas."
          right={
            <Switch
              checked={get("show_agent_name", true)}
              onCheckedChange={(v) => set("show_agent_name", v)}
            />
          }
        />

        {/* Ocultar números de telefone */}
        <SettingRow
          title="Ocultar números de telefone"
          description="Oculta os 4 últimos dígitos do telefone (privacidade)."
          right={
            <Switch
              checked={get("mask_phone_numbers", true)}
              onCheckedChange={(v) => set("mask_phone_numbers", v)}
            />
          }
        />

        {/* Ocultar conversas iniciadas via disparos */}
        <SettingRow
          title="Ocultar conversas iniciadas via disparos"
          description="Não exibe as conversas sem interação que foram iniciadas através da opção de Disparos."
          right={
            <Switch
              checked={get("hide_campaign_conversations", true)}
              onCheckedChange={(v) => set("hide_campaign_conversations", v)}
            />
          }
        />

        {/* Finalizar atendimento por inatividade */}
        <SettingRow
          title="Finalizar atendimento por inatividade"
          description="Caso o usuário ou cliente não enviem uma mensagem por determinado período, o atendimento será finalizado automaticamente."
          right={
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAutoCloseDialog(true)}>
              <Settings2 className="w-3.5 h-3.5" />
              Configurar
            </Button>
          }
        />

        {/* Horário de Atendimento */}
        <SettingRow
          title="Horário de Atendimento"
          description="Defina os horários de atendimento e as ações a serem executadas quando um cliente entrar em contato fora de hora."
          right={
            <div className="flex items-center gap-3">
              <Switch
                checked={get("business_hours_enabled", false)}
                onCheckedChange={(v) => set("business_hours_enabled", v)}
              />
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBusinessHoursDialog(true)}>
                <Settings2 className="w-3.5 h-3.5" />
                Configurar
              </Button>
            </div>
          }
        />

        {/* MFA */}
        <SettingRow
          title={
            <span className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Autenticação de dois fatores (MFA)
            </span>
          }
          description="Ativa uma camada extra de segurança para acessar o sistema. Além da senha, será necessário informar um código temporário gerado pelo app Google Authenticator no celular."
          right={
            <Switch
              checked={get("mfa_enabled", false)}
              onCheckedChange={(v) => set("mfa_enabled", v)}
            />
          }
        />

        {/* Fuso horário padrão */}
        <SettingRow
          title="Fuso horário padrão"
          right={
            <Select
              value={get("timezone", "America/Sao_Paulo")}
              onValueChange={(v) => set("timezone", v)}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Sao_Paulo">Brasília Time (BRT) GMT-3</SelectItem>
                <SelectItem value="America/Manaus">Amazonas (AMT) GMT-4</SelectItem>
                <SelectItem value="America/Belem">Belém (BRT) GMT-3</SelectItem>
                <SelectItem value="America/Fortaleza">Fortaleza (BRT) GMT-3</SelectItem>
                <SelectItem value="America/Noronha">Fernando de Noronha (FNT) GMT-2</SelectItem>
                <SelectItem value="America/Rio_Branco">Acre (ACT) GMT-5</SelectItem>
              </SelectContent>
            </Select>
          }
        />

        {/* Código do país */}
        <SettingRow
          title="Código do país"
          right={
            <Select
              value={get("country_code", "+55")}
              onValueChange={(v) => set("country_code", v)}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="+55">Brasil (+55)</SelectItem>
                <SelectItem value="+1">EUA (+1)</SelectItem>
                <SelectItem value="+351">Portugal (+351)</SelectItem>
                <SelectItem value="+54">Argentina (+54)</SelectItem>
                <SelectItem value="+56">Chile (+56)</SelectItem>
                <SelectItem value="+57">Colômbia (+57)</SelectItem>
              </SelectContent>
            </Select>
          }
        />
      </div>

      {/* Auto Distribution Dialog */}
      <Dialog open={autoDistDialog} onOpenChange={setAutoDistDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Distribuição Automática</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Intervalo de redistribuição (minutos)</Label>
              <Input
                type="number"
                value={get("auto_distribution_interval", 5)}
                onChange={(e) => set("auto_distribution_interval", Number(e.target.value))}
                min={1}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se um agente não responder dentro deste intervalo, a conversa será redistribuída para outro agente disponível.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoDistDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto Close Dialog */}
      <Dialog open={autoCloseDialog} onOpenChange={setAutoCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar por Inatividade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Ativar finalização automática</Label>
              <Switch
                checked={get("auto_close_enabled", false)}
                onCheckedChange={(v) => set("auto_close_enabled", v)}
              />
            </div>
            <div>
              <Label>Tempo de inatividade (minutos)</Label>
              <Input
                type="number"
                value={get("auto_close_minutes", 60)}
                onChange={(e) => set("auto_close_minutes", Number(e.target.value))}
                min={5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                A conversa será finalizada automaticamente após este período sem interação.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoCloseDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Business Hours Dialog */}
      <Dialog open={businessHoursDialog} onOpenChange={setBusinessHoursDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Horário de Atendimento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Configure os horários de atendimento na página dedicada em{" "}
            <a href="/settings/work-schedule" className="text-primary underline">Configurações &gt; Horário de Trabalho</a>.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBusinessHoursDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* Reusable row component */
interface SettingRowProps {
  title: React.ReactNode;
  description?: string;
  descriptionExtra?: React.ReactNode;
  right: React.ReactNode;
}

const SettingRow = ({ title, description, descriptionExtra, right }: SettingRowProps) => (
  <div className="flex items-center justify-between gap-6 bg-card border border-border rounded-xl px-5 py-4">
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      {descriptionExtra}
    </div>
    <div className="flex-shrink-0">{right}</div>
  </div>
);

export default GeneralSettings;

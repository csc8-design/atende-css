import { useState, useRef } from "react";
import { Paintbrush, Upload, Globe, Type, Image, Save, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

const SUPER_ADMIN_EMAIL = "admin@bsec.com.br";

const BrandingSettings = () => {
  const { user } = useAuth();
  const { settings, loading, updateSetting, saveAll } = useSystemSettings();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoLightInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  if (user?.email?.toLowerCase() !== SUPER_ADMIN_EMAIL) {
    return <Navigate to="/settings" replace />;
  }



  const get = (key: string, fallback = "") => {
    const val = settings[`branding_${key}`];
    if (val === null || val === undefined) return fallback;
    return typeof val === "string" ? val : String(val);
  };

  const set = (key: string, value: string) => {
    updateSetting(`branding_${key}`, value);
  };

  const handleUpload = async (file: File, field: string) => {
    setUploading(field);
    try {
      const ext = file.name.split(".").pop();
      const path = `branding/${field}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      set(field, urlData.publicUrl);
      toast({ title: "Imagem enviada com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar imagem", description: err.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const brandingKeys = Object.keys(settings).filter((k) => k.startsWith("branding_"));
    const map: Record<string, any> = {};
    for (const k of brandingKeys) {
      map[k] = settings[k];
    }
    // Also save any new keys that were set
    const allKeys = [
      "platform_name", "platform_description", "logo_url", "logo_light_url",
      "favicon_url", "login_bg_color", "login_text", "login_footer",
      "email_placeholder", "support_text",
    ];
    for (const k of allKeys) {
      const fullKey = `branding_${k}`;
      if (settings[fullKey] !== undefined) {
        map[fullKey] = settings[fullKey];
      }
    }
    await saveAll(map);
    // Clear cache so changes take effect
    localStorage.removeItem("branding_cache");
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Paintbrush className="w-6 h-6 text-primary" />
            White-Label / Branding
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Personalize a identidade visual da plataforma para seus clientes.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </Button>
      </div>

      {/* Platform Identity */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Type className="w-4 h-4 text-primary" />
          Identidade da Plataforma
        </h3>

        <div className="grid gap-4">
          <div>
            <Label className="text-xs">Nome da Plataforma</Label>
            <Input
              value={get("platform_name", "Atende CSS · ENGWE")}
              onChange={(e) => set("platform_name", e.target.value)}
              placeholder="Nome exibido no sistema"
            />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea
              value={get("platform_description", "Gestão integrada de conversas, atendentes e clientes via WhatsApp Business.")}
              onChange={(e) => set("platform_description", e.target.value)}
              rows={2}
              placeholder="Descrição breve da plataforma"
            />
          </div>
        </div>
      </div>

      {/* Logos */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Image className="w-4 h-4 text-primary" />
          Logotipos
        </h3>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Logo dark/main */}
          <div className="space-y-2">
            <Label className="text-xs">Logo Principal (tema escuro)</Label>
            <div
              className="border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center min-h-[120px] cursor-pointer hover:border-primary/50 transition-colors bg-secondary/30"
              onClick={() => logoInputRef.current?.click()}
            >
              {get("logo_url") ? (
                <img src={get("logo_url")} alt="Logo" className="max-h-16 object-contain" />
              ) : (
                <>
                  <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Enviar logo</span>
                </>
              )}
              {uploading === "logo_url" && <Loader2 className="w-4 h-4 animate-spin mt-1" />}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "logo_url")}
            />
          </div>

          {/* Logo light */}
          <div className="space-y-2">
            <Label className="text-xs">Logo (tema claro)</Label>
            <div
              className="border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center min-h-[120px] cursor-pointer hover:border-primary/50 transition-colors bg-background"
              onClick={() => logoLightInputRef.current?.click()}
            >
              {get("logo_light_url") ? (
                <img src={get("logo_light_url")} alt="Logo Light" className="max-h-16 object-contain" />
              ) : (
                <>
                  <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Enviar logo</span>
                </>
              )}
              {uploading === "logo_light_url" && <Loader2 className="w-4 h-4 animate-spin mt-1" />}
            </div>
            <input
              ref={logoLightInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "logo_light_url")}
            />
          </div>

          {/* Favicon */}
          <div className="space-y-2">
            <Label className="text-xs">Favicon</Label>
            <div
              className="border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center min-h-[120px] cursor-pointer hover:border-primary/50 transition-colors bg-secondary/30"
              onClick={() => faviconInputRef.current?.click()}
            >
              {get("favicon_url") ? (
                <img src={get("favicon_url")} alt="Favicon" className="max-h-10 object-contain" />
              ) : (
                <>
                  <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Enviar favicon</span>
                </>
              )}
              {uploading === "favicon_url" && <Loader2 className="w-4 h-4 animate-spin mt-1" />}
            </div>
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/*,.ico"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "favicon_url")}
            />
          </div>
        </div>
      </div>

      {/* Login Page */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          Tela de Login
        </h3>

        <div className="grid gap-4">
          <div>
            <Label className="text-xs">Texto de apoio na tela de login</Label>
            <Input
              value={get("login_text", "Entre com seu e-mail corporativo")}
              onChange={(e) => set("login_text", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Placeholder do campo de e-mail</Label>
            <Input
              value={get("email_placeholder", "seu@email.com")}
              onChange={(e) => set("email_placeholder", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Texto de suporte (rodapé do formulário)</Label>
            <Textarea
              value={get("support_text", "Em caso de dúvidas, contate o suporte.")}
              onChange={(e) => set("support_text", e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label className="text-xs">Crédito de rodapé</Label>
            <Input
              value={get("login_footer", "Desenvolvido por Bsec Tech — Todos os direitos reservados © 2026")}
              onChange={(e) => set("login_footer", e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandingSettings;

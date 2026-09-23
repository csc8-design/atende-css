import { useEffect, useState, useRef } from "react";
import { Paintbrush, Upload, Loader2, Save } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface Tenant {
  id: string; name: string; slug: string;
  logo_url: string | null; favicon_url: string | null;
  primary_color: string | null; platform_name: string | null;
  login_title: string | null; login_subtitle: string | null;
  custom_domain: string | null;
}

const WhitelabelPage = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  const fetchTenants = async () => {
    const { data } = await supabaseAdmin.from("tenants").select("id, name, slug, logo_url, favicon_url, primary_color, platform_name, login_title, login_subtitle, custom_domain").order("name");
    setTenants((data || []) as Tenant[]);
    setLoading(false);
  };

  useEffect(() => { fetchTenants(); }, []);

  useEffect(() => {
    if (selected) setTenant(tenants.find(t => t.id === selected) || null);
    else setTenant(null);
  }, [selected, tenants]);

  const update = (field: keyof Tenant, value: string) => {
    setTenant(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleUpload = async (file: File, field: "logo_url" | "favicon_url") => {
    if (!tenant) return;
    setUploading(field);
    try {
      const ext = file.name.split(".").pop();
      const path = `tenants/${tenant.slug}/${field}-${Date.now()}.${ext}`;
      const { error } = await supabaseAdmin.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabaseAdmin.storage.from("avatars").getPublicUrl(path);
      update(field, urlData.publicUrl);
      toast({ title: "Imagem enviada!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setUploading(null); }
  };

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    const { error } = await supabaseAdmin.from("tenants").update({
      logo_url: tenant.logo_url,
      favicon_url: tenant.favicon_url,
      primary_color: tenant.primary_color,
      platform_name: tenant.platform_name,
      login_title: tenant.login_title,
      login_subtitle: tenant.login_subtitle,
      custom_domain: tenant.custom_domain,
    } as any).eq("id", tenant.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "White-label salvo!" }); fetchTenants(); }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Carregando...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Paintbrush className="w-6 h-6 text-primary" /> White-Label por Empresa
        </h1>
        <p className="text-sm text-muted-foreground">Configure a identidade visual de cada empresa cliente.</p>
      </div>

      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="w-[300px]"><SelectValue placeholder="Selecionar empresa" /></SelectTrigger>
        <SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
      </Select>

      {tenant && (
        <div className="space-y-5">
          {/* Identidade */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Identidade</h3>
            <div className="grid gap-3">
              <div><Label className="text-xs">Nome da Plataforma</Label><Input value={tenant.platform_name || ""} onChange={e => update("platform_name", e.target.value)} /></div>
              <div><Label className="text-xs">Cor Primária</Label><div className="flex gap-2"><Input value={tenant.primary_color || "#6366f1"} onChange={e => update("primary_color", e.target.value)} /><input type="color" value={tenant.primary_color || "#6366f1"} onChange={e => update("primary_color", e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" /></div></div>
              <div><Label className="text-xs">Domínio Customizado</Label><Input value={tenant.custom_domain || ""} onChange={e => update("custom_domain", e.target.value)} placeholder="app.empresa.com" /></div>
            </div>
          </div>

          {/* Logos */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Logotipos</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Logo</Label>
                <div className="border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center min-h-[100px] cursor-pointer hover:border-primary/50 transition-colors" onClick={() => logoRef.current?.click()}>
                  {tenant.logo_url ? <img src={tenant.logo_url} alt="Logo" className="max-h-14 object-contain" /> : <><Upload className="w-5 h-5 text-muted-foreground" /><span className="text-xs text-muted-foreground mt-1">Enviar</span></>}
                  {uploading === "logo_url" && <Loader2 className="w-4 h-4 animate-spin mt-1" />}
                </div>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], "logo_url")} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Favicon</Label>
                <div className="border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center min-h-[100px] cursor-pointer hover:border-primary/50 transition-colors" onClick={() => faviconRef.current?.click()}>
                  {tenant.favicon_url ? <img src={tenant.favicon_url} alt="Favicon" className="max-h-10 object-contain" /> : <><Upload className="w-5 h-5 text-muted-foreground" /><span className="text-xs text-muted-foreground mt-1">Enviar</span></>}
                  {uploading === "favicon_url" && <Loader2 className="w-4 h-4 animate-spin mt-1" />}
                </div>
                <input ref={faviconRef} type="file" accept="image/*,.ico" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], "favicon_url")} />
              </div>
            </div>
          </div>

          {/* Tela de Login */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Tela de Login</h3>
            <div className="grid gap-3">
              <div><Label className="text-xs">Título</Label><Input value={tenant.login_title || ""} onChange={e => update("login_title", e.target.value)} placeholder="Bem-vindo ao Sistema" /></div>
              <div><Label className="text-xs">Subtítulo</Label><Textarea value={tenant.login_subtitle || ""} onChange={e => update("login_subtitle", e.target.value)} rows={2} placeholder="Entre com suas credenciais" /></div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar White-Label
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhitelabelPage;

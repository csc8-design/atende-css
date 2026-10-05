import { useEffect, useState } from "react";
import { Copy, Loader2, Save, PlugZap, Link2, KeyRound, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Status = {
  callback_url: string;
  token_masked: string | null;
  token_source: "settings" | "secret" | null;
  phone_number_id: string;
  business_account_id: string;
  app_id: string;
  verify_token: string;
  updated_at: string | null;
};

const inputCls =
  "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground";

const call = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("meta-config", { body });
  if (error) {
    const ctx: any = (error as any).context;
    const txt = ctx?.text ? await ctx.text() : error.message;
    throw new Error(txt);
  }
  return data;
};

const MetaSettings = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [token, setToken] = useState("");
  const [form, setForm] = useState({ phone_number_id: "", business_account_id: "", app_id: "", verify_token: "" });
  const [test, setTest] = useState<any>(null);

  const load = async () => {
    try {
      const s: Status = await call({ action: "status" });
      setStatus(s);
      setForm({
        phone_number_id: s.phone_number_id,
        business_account_id: s.business_account_id,
        app_id: s.app_id,
        verify_token: s.verify_token,
      });
    } catch (e: any) {
      toast({ title: "Erro ao carregar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast({ title: "Copiado!" });
  };

  const save = async () => {
    setSaving(true);
    try {
      await call({ action: "save", access_token: token, ...form });
      setToken("");
      toast({ title: "Dados da Meta salvos" });
      await load();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      setTest(await call({ action: "test" }));
    } catch (e: any) {
      setTest({ ok: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meta · WhatsApp Cloud API</h1>
        <p className="text-sm text-muted-foreground mt-1">Conecte o número oficial do WhatsApp Business ao sistema</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" /> Webhook (cole no painel da Meta)
        </h3>
        {[
          { label: "URL de callback", value: status?.callback_url || "" },
          { label: "Token de verificação", value: form.verify_token },
        ].map((f) => (
          <div key={f.label}>
            <label className="block text-sm font-medium text-foreground mb-1.5">{f.label}</label>
            <div className="flex gap-2">
              <input readOnly className={`${inputCls} font-mono text-xs`} value={f.value} />
              <button onClick={() => copy(f.value)} className="px-3 rounded-lg border border-border hover:bg-secondary text-muted-foreground">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Na Meta: WhatsApp → Configuração → Webhook → Editar. Depois assine o campo <b>messages</b>.
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" /> Credenciais
        </h3>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Token de acesso (permanente)</label>
          <input
            type="password"
            className={inputCls}
            placeholder={status?.token_masked ? `Atual: ${status.token_masked} — deixe vazio para manter` : "EAAG..."}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Gere em Business Settings → Usuários do sistema → Gerar token, marcando "Nunca expira" e as permissões
            whatsapp_business_messaging e whatsapp_business_management.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">ID do número de telefone</label>
            <input className={inputCls} value={form.phone_number_id} onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">ID da conta WhatsApp Business</label>
            <input className={inputCls} value={form.business_account_id} onChange={(e) => setForm({ ...form, business_account_id: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">ID do app (opcional)</label>
            <input className={inputCls} value={form.app_id} onChange={(e) => setForm({ ...form, app_id: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Token de verificação</label>
            <input className={inputCls} value={form.verify_token} onChange={(e) => setForm({ ...form, verify_token: e.target.value })} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
          </button>
          <button onClick={runTest} disabled={testing} className="flex items-center gap-2 border border-border px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary text-foreground disabled:opacity-50">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />} Testar conexão
          </button>
          <a href="https://business.facebook.com/latest/whatsapp_manager" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2.5 text-sm text-primary hover:underline">
            WhatsApp Manager <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
        {test && (
          <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${test.ok ? "bg-primary/10 text-foreground" : "bg-destructive/10 text-destructive"}`}>
            {test.ok ? <CheckCircle2 className="w-4 h-4 text-primary mt-0.5" /> : <XCircle className="w-4 h-4 mt-0.5" />}
            <div>
              {test.ok ? (
                <>
                  Conectado: <b>{test.name}</b> ({test.phone}) · qualidade {test.quality || "—"}
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {test.expires_at ? `Token vence em ${new Date(test.expires_at * 1000).toLocaleString("pt-BR")}` : "Token sem data de vencimento"}
                  </div>
                </>
              ) : (
                <>Falha: {test.error}</>
              )}
            </div>
          </div>
        )}
      </div>
      <TemplatesCard />
    </div>
  );
};

const TemplatesCard = () => {
  const [items, setItems] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = async () => {
    setLoading(true); setErr(null);
    const { data, error } = await supabase.functions.invoke("list-wa-templates", { body: {} });
    if (error || data?.error || data?.raw?.error) setErr(data?.raw?.error?.message || data?.error || error?.message || "Falha");
    else setItems((data?.raw?.data || []).filter((t: any) => t.status === "APPROVED"));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Templates aprovados</h3>
        <button onClick={load} disabled={loading} className="text-sm text-primary hover:underline disabled:opacity-50">
          {loading ? "Carregando..." : "Atualizar"}
        </button>
      </div>
      {err && <p className="text-sm text-destructive">Não foi possível consultar a Meta: {err}</p>}
      {items && items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum template aprovado.</p>}
      <div className="space-y-3">
        {items?.map((t) => {
          const comps = t.components || [];
          const header = comps.find((c: any) => c.type === "HEADER");
          const body = comps.find((c: any) => c.type === "BODY");
          const buttons = comps.find((c: any) => c.type === "BUTTONS");
          const vars = (body?.text?.match(/\{\{\d+\}\}/g) || []).length;
          return (
            <div key={t.name + t.language} className="border border-border rounded-lg p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold text-foreground">{t.name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{t.language}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{t.category}</span>
                {header && <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">Cabeçalho: {header.format}</span>}
                <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{vars} variáve{vars === 1 ? "l" : "is"}</span>
              </div>
              {body?.text && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{body.text}</p>}
              {buttons?.buttons?.length > 0 && (
                <p className="text-xs text-muted-foreground">Botões: {buttons.buttons.map((b: any) => b.text).join(", ")}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MetaSettings;

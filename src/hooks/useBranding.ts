import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BrandingConfig {
  platform_name: string;
  platform_description: string;
  logo_url: string;
  logo_light_url: string;
  favicon_url: string;
  login_bg_color: string;
  login_text: string;
  login_footer: string;
  email_placeholder: string;
  support_text: string;
}

const DEFAULTS: BrandingConfig = {
  platform_name: "Atende CSS · ENGWE",
  platform_description: "Gestão integrada de conversas, atendentes e clientes via WhatsApp Business.",
  logo_url: "",
  logo_light_url: "",
  favicon_url: "",
  login_bg_color: "214, 32%, 91%",
  login_text: "Entre com seu e-mail corporativo",
  login_footer: "Desenvolvido por Bsec Tech — Todos os direitos reservados © 2026",
  email_placeholder: "seu@email.com",
  support_text: "Em caso de dúvidas, contate o suporte.",
};

const CACHE_KEY = "branding_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 min

function getCached(): BrandingConfig | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function setCache(data: BrandingConfig) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
}

export function useBranding() {
  const [branding, setBranding] = useState<BrandingConfig>(() => getCached() || DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchBranding = useCallback(async () => {
    const { data, error } = await supabase
      .from("system_settings")
      .select("key, value")
      .like("key", "branding_%");

    if (error || !data?.length) {
      setLoading(false);
      return;
    }

    const config = { ...DEFAULTS };
    for (const row of data) {
      const field = row.key.replace("branding_", "") as keyof BrandingConfig;
      if (field in config && row.value !== null && row.value !== undefined) {
        config[field] = typeof row.value === "string" ? row.value : String(row.value);
      }
    }

    setBranding(config);
    setCache(config);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  return { branding, loading, refetch: fetchBranding };
}

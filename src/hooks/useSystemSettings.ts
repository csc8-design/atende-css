import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type SettingsMap = Record<string, any>;

export function useSystemSettings() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from("system_settings")
      .select("key, value");
    if (error) {
      console.error("Fetch settings error:", error);
      return;
    }
    const map: SettingsMap = {};
    for (const row of data || []) {
      map[row.key] = row.value;
    }
    setSettings(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveAll = useCallback(async (current: SettingsMap) => {
    setSaving(true);
    try {
      const entries = Object.entries(current);
      for (const [key, value] of entries) {
        await supabase
          .from("system_settings")
          .upsert({ key, value: JSON.parse(JSON.stringify(value)), updated_at: new Date().toISOString() }, { onConflict: "key" });
      }
      toast({ title: "Configurações salvas com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, loading, saving, updateSetting, saveAll, refetch: fetchSettings };
}

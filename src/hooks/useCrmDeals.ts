import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CrmStage {
  id: string;
  name: string;
  position: number;
  color: string;
}

export interface CrmDeal {
  id: string;
  conversation_id: string;
  contact_id: string;
  stage_id: string;
  title: string;
  company_name: string | null;
  contact_name: string | null;
  estimated_value: number | null;
  priority: number;
  status: "em_andamento" | "perdida" | "vendida";
  temperature: string | null;
  assigned_agent_id: string | null;
  notes: string | null;
  next_contact_at: string | null;
  last_interaction_at: string;
  created_at: string;
  updated_at: string;
  // Enriched
  department_id?: string | null;
  department_name?: string | null;
  contact_phone?: string | null;
  open_tasks?: number;
}

export interface CrmTask {
  id: string;
  deal_id: string;
  title: string;
  due_at: string | null;
  completed: boolean;
  created_by: string;
  created_at: string;
}

export function useCrmDeals() {
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [stagesRes, dealsRes] = await Promise.all([
      supabase.from("crm_stages" as any).select("*").order("position"),
      supabase.from("crm_deals" as any).select("*").order("updated_at", { ascending: false }),
    ]);
    if (stagesRes.data) setStages(stagesRes.data as any);

    let result: CrmDeal[] = (dealsRes.data as any) || [];

    if (result.length > 0) {
      const convIds = result.map((d) => d.conversation_id);
      const contactIds = result.map((d) => d.contact_id);
      const dealIds = result.map((d) => d.id);

      const [convs, contacts, depts, tasks] = await Promise.all([
        supabase.from("conversations").select("id, department_id").in("id", convIds),
        supabase.from("contacts").select("id, phone").in("id", contactIds),
        supabase.from("departments").select("id, name"),
        supabase.from("crm_tasks" as any).select("deal_id, completed").in("deal_id", dealIds),
      ]);

      const convMap: Record<string, string | null> = {};
      (convs.data || []).forEach((c: any) => { convMap[c.id] = c.department_id; });
      const contactMap: Record<string, string> = {};
      (contacts.data || []).forEach((c: any) => { contactMap[c.id] = c.phone; });
      const deptMap: Record<string, string> = {};
      (depts.data || []).forEach((d: any) => { deptMap[d.id] = d.name; });
      const taskCount: Record<string, number> = {};
      ((tasks.data as any) || []).forEach((t: any) => {
        if (!t.completed) taskCount[t.deal_id] = (taskCount[t.deal_id] || 0) + 1;
      });

      result = result.map((d) => ({
        ...d,
        department_id: convMap[d.conversation_id] || null,
        department_name: convMap[d.conversation_id] ? deptMap[convMap[d.conversation_id] as string] : null,
        contact_phone: contactMap[d.contact_id] || null,
        open_tasks: taskCount[d.id] || 0,
      }));
    }

    setDeals(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("crm-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_deals" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_tasks" }, () => fetchAll())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const updateDeal = async (id: string, patch: Partial<CrmDeal>) => {
    const dbPatch: any = { ...patch };
    delete dbPatch.department_id;
    delete dbPatch.department_name;
    delete dbPatch.contact_phone;
    delete dbPatch.open_tasks;
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } as CrmDeal : d)));
    const { error } = await supabase.from("crm_deals" as any).update(dbPatch).eq("id", id);
    if (error) {
      console.error("update deal error:", error);
      fetchAll();
    }
  };

  const createTask = async (dealId: string, title: string, dueAt: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("crm_tasks" as any).insert({
      deal_id: dealId, title, due_at: dueAt, created_by: user.id,
    });
    if (error) console.error("create task error:", error);
    else fetchAll();
  };

  const fetchTasks = async (dealId: string): Promise<CrmTask[]> => {
    const { data } = await supabase
      .from("crm_tasks" as any)
      .select("*")
      .eq("deal_id", dealId)
      .order("due_at", { ascending: true, nullsFirst: false });
    return (data as any) || [];
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    await supabase.from("crm_tasks" as any).update({ completed }).eq("id", taskId);
    fetchAll();
  };

  return { stages, deals, loading, refetch: fetchAll, updateDeal, createTask, fetchTasks, toggleTask };
}

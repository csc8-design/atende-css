import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const TARGET_DEPARTMENTS = ["Peças Balcão", "Comercial", "Pós-Vendas"] as const;
export type TargetDept = (typeof TARGET_DEPARTMENTS)[number];

export interface PortfolioContact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  company_name: string | null;
  category: string | null;
  tags: string[] | null;
  notes: string | null;
  updated_at: string;
  assigned_agent_id: string | null;
}

export interface ConvInfo {
  id: string;
  lead_score: string | null;
  sentiment: string | null;
  ai_summary: string | null;
  last_message_at: string | null;
}

export interface AgentInfo {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface InterestInfo {
  interest: string | null;
  interest_type: string | null;
  brands: string[] | null;
  models: string[] | null;
  last_analyzed_at: string | null;
}

export function useCarteira() {
  const { user, isAdmin, roles } = useAuth();
  const isSupervisor = roles.includes("manager") && !isAdmin;
  const isOnlyAgent = !isAdmin && !isSupervisor;

  const [contacts, setContacts] = useState<PortfolioContact[]>([]);
  const [convs, setConvs] = useState<Record<string, ConvInfo>>({});
  const [interests, setInterests] = useState<Record<string, InterestInfo>>({});
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentDeptMap, setAgentDeptMap] = useState<Record<string, TargetDept[]>>({});
  const [loading, setLoading] = useState(true);


  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: depts } = await supabase
      .from("departments")
      .select("id, name")
      .in("name", TARGET_DEPARTMENTS as unknown as string[]);
    const deptIdToName: Record<string, TargetDept> = {};
    (depts || []).forEach((d: any) => {
      deptIdToName[d.id] = d.name as TargetDept;
    });
    const targetDeptIds = Object.keys(deptIdToName);

    const { data: allAds } = await supabase
      .from("agent_departments")
      .select("agent_id, department_id")
      .in("department_id", targetDeptIds);
    const deptMap: Record<string, TargetDept[]> = {};
    (allAds || []).forEach((a: any) => {
      const dn = deptIdToName[a.department_id];
      if (!dn) return;
      if (!deptMap[a.agent_id]) deptMap[a.agent_id] = [];
      if (!deptMap[a.agent_id].includes(dn)) deptMap[a.agent_id].push(dn);
    });
    setAgentDeptMap(deptMap);
    const agentsInTargetDepts = new Set(Object.keys(deptMap));

    let scopedAgentIds: string[];
    if (isOnlyAgent) {
      scopedAgentIds = [user.id];
    } else if (isSupervisor) {
      const { data: myDepts } = await supabase
        .from("agent_departments")
        .select("department_id")
        .eq("agent_id", user.id);
      const myDeptIds = (myDepts || [])
        .map((d: any) => d.department_id)
        .filter((id: string) => targetDeptIds.includes(id));
      if (myDeptIds.length === 0) {
        scopedAgentIds = [];
      } else {
        const { data: ads } = await supabase
          .from("agent_departments")
          .select("agent_id")
          .in("department_id", myDeptIds);
        scopedAgentIds = Array.from(new Set<string>((ads || []).map((a: any) => a.agent_id)));
      }
    } else {
      scopedAgentIds = Array.from(agentsInTargetDepts);
    }

    let profs: AgentInfo[] = [];
    if (scopedAgentIds.length) {
      const { data: pf } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", scopedAgentIds);
      profs = (pf as any as AgentInfo[]) || [];
    }
    setAgents(profs);

    if (!scopedAgentIds.length) {
      setContacts([]);
      setConvs({});
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("contacts")
      .select("id, name, phone, email, avatar_url, company_name, category, tags, notes, updated_at, assigned_agent_id")
      .in("assigned_agent_id", scopedAgentIds)
      .order("updated_at", { ascending: false })
      .limit(10000);
    const list = (data as any as PortfolioContact[]) || [];
    setContacts(list);

    if (list.length) {
      const ids = list.map((c) => c.id);
      const map: Record<string, ConvInfo> = {};
      const CHUNK = 300;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const { data: cd } = await supabase
          .from("conversations")
          .select("id, contact_id, lead_score, sentiment, ai_summary, last_message_at")
          .in("contact_id", slice)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(5000);
        (cd || []).forEach((c: any) => {
          const prev = map[c.contact_id];
          if (!prev || (c.last_message_at && (!prev.last_message_at || c.last_message_at > prev.last_message_at))) {
            map[c.contact_id] = {
              id: c.id,
              lead_score: c.lead_score,
              sentiment: c.sentiment,
              ai_summary: c.ai_summary,
              last_message_at: c.last_message_at,
            };
          }
        });
      }
      setConvs(map);

      const imap: Record<string, InterestInfo> = {};
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const { data: itd } = await supabase
          .from("contact_interests")
          .select("contact_id, interest, interest_type, brands, models, last_analyzed_at")
          .in("contact_id", slice);
        (itd || []).forEach((r: any) => {
          imap[r.contact_id] = {
            interest: r.interest,
            interest_type: r.interest_type,
            brands: r.brands,
            models: r.models,
            last_analyzed_at: r.last_analyzed_at,
          };
        });
      }
      setInterests(imap);
    } else {
      setConvs({});
      setInterests({});
    }

    setLoading(false);
  }, [user, isAdmin, isSupervisor, isOnlyAgent]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const sixtyDaysAgo = useMemo(() => Date.now() - 60 * 24 * 60 * 60 * 1000, []);
  const hasInteracted60d = useCallback(
    (contactId: string) => {
      const c = convs[contactId];
      if (!c?.last_message_at) return false;
      return new Date(c.last_message_at).getTime() >= sixtyDaysAgo;
    },
    [convs, sixtyDaysAgo],
  );

  return {
    contacts,
    convs,
    interests,
    setInterests,
    agents,

    agentDeptMap,
    loading,
    isAdmin,
    isSupervisor,
    isOnlyAgent,
    hasInteracted60d,
    refetch: fetchAll,
    setContacts,
  };
}

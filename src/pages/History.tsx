import { useState, useEffect, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import ChannelBadge from "@/components/shared/ChannelBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const PAGE_SIZE = 20;

interface HistoryItem {
  id: string;
  channel: string;
  closing_reason: string | null;
  closed_at: string | null;
  created_at: string;
  contacts: { name: string } | null;
  assigned_agent_id: string | null;
  agentName?: string;
  duration?: string;
}

const History = () => {
  const isMobile = useIsMobile();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const fetchHistory = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("conversations")
      .select("id, channel, closing_reason, closed_at, created_at, assigned_agent_id, contacts(name)")
      .in("status", ["closed", "resolved"])
      .order("closed_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, error } = await query;
    if (error) {
      console.error("History fetch error:", error);
      setLoading(false);
      return;
    }

    const conversations = (data as any[]) || [];

    const agentIds = [...new Set(conversations.filter(c => c.assigned_agent_id).map(c => c.assigned_agent_id))];
    let agentMap: Record<string, string> = {};
    if (agentIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", agentIds);
      (profiles || []).forEach((p: any) => { agentMap[p.user_id] = p.full_name; });
    }

    const enriched = conversations
      .filter(c => {
        if (!search) return true;
        const contactName = c.contacts?.name || "";
        return contactName.toLowerCase().includes(search.toLowerCase());
      })
      .map(c => {
        const durationMs = c.closed_at && c.created_at
          ? new Date(c.closed_at).getTime() - new Date(c.created_at).getTime()
          : 0;
        const minutes = Math.round(durationMs / 60000);
        return {
          ...c,
          agentName: agentMap[c.assigned_agent_id] || "Não atribuído",
          duration: minutes > 0 ? `${minutes} min` : "—",
        };
      });

    setItems(enriched);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    setPage(0);
  }, [search]);

  return (
    <AppLayout>
      <div className={`${isMobile ? 'px-4 py-4' : 'p-6 lg:p-8'} max-w-7xl mx-auto space-y-4`}>
        <div>
          <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-foreground`}>Histórico</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Conversas finalizadas</p>
        </div>

        <div className={`relative ${isMobile ? '' : 'max-w-md'}`}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Mobile: card layout */}
        {isMobile ? (
          <div className="space-y-2">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma conversa finalizada</div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="bg-card rounded-xl border border-border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-foreground">{item.contacts?.name || "—"}</span>
                    <ChannelBadge channel={item.channel as any} size="md" />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Atendente: {item.agentName}</span>
                    <span>{item.duration}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-secondary text-muted-foreground">
                      {item.closing_reason || "Sem motivo"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.closed_at ? format(new Date(item.closed_at), "dd/MM/yy HH:mm") : "—"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Desktop: table layout */
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contato</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Canal</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Atendente</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Motivo</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duração</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Encerrada</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">Carregando...</td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma conversa finalizada</td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                      <td className="px-5 py-3.5 text-sm font-medium text-foreground">{item.contacts?.name || "—"}</td>
                      <td className="px-5 py-3.5"><ChannelBadge channel={item.channel as any} size="md" /></td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">{item.agentName}</td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-secondary text-muted-foreground">
                          {item.closing_reason || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">{item.duration}</td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">
                        {item.closed_at ? format(new Date(item.closed_at), "dd/MM/yyyy HH:mm") : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-center gap-4 pb-4">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="text-primary disabled:text-muted-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-muted-foreground">Página {page + 1}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={items.length < PAGE_SIZE} className="text-primary disabled:text-muted-foreground">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </AppLayout>
  );
};

export default History;

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Edit2, Trash2, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface QuickReply {
  id: string;
  title: string;
  content: string;
  shortcut: string | null;
  is_global: boolean;
  created_by: string | null;
  created_at: string;
}

const emptyForm = { title: "", content: "", shortcut: "" };

const QuickReplies = () => {
  const { user, isManager, isAdmin } = useAuth();
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchReplies = useCallback(async () => {
    const { data, error } = await supabase
      .from("quick_replies")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Fetch quick replies error:", error);
    }
    setReplies((data as QuickReply[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchReplies(); }, [fetchReplies]);

  const filtered = replies.filter(r =>
    (r.shortcut || "").toLowerCase().includes(search.toLowerCase()) ||
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.content.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (reply: QuickReply) => {
    setEditing(reply);
    setForm({ title: reply.title, content: reply.content, shortcut: reply.shortcut || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim() || !user) return;
    setSubmitting(true);

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      shortcut: form.shortcut.trim() || null,
      created_by: user.id,
      is_global: false,
    };

    if (editing) {
      const { error } = await supabase
        .from("quick_replies")
        .update({ title: payload.title, content: payload.content, shortcut: payload.shortcut })
        .eq("id", editing.id);
      if (error) {
        toast.error("Erro ao atualizar resposta rápida");
        console.error(error);
      } else {
        toast.success("Resposta atualizada");
      }
    } else {
      const { error } = await supabase.from("quick_replies").insert(payload);
      if (error) {
        toast.error("Erro ao criar resposta rápida");
        console.error(error);
      } else {
        toast.success("Resposta criada");
      }
    }

    setSubmitting(false);
    setDialogOpen(false);
    fetchReplies();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("quick_replies").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir resposta rápida");
      console.error(error);
    } else {
      toast.success("Resposta excluída");
      fetchReplies();
    }
  };

  const canEdit = (reply: QuickReply) => {
    return isAdmin || isManager || reply.created_by === user?.id;
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Respostas Rápidas</h1>
          <p className="text-sm text-muted-foreground mt-1">Crie atalhos para mensagens frequentes</p>
        </div>
        <Button onClick={openNew} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nova Resposta
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar respostas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {search ? "Nenhuma resposta encontrada" : "Nenhuma resposta rápida cadastrada"}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((reply) => (
            <div key={reply.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {reply.shortcut && (
                      <code className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">{reply.shortcut}</code>
                    )}
                    <span className="text-sm font-medium text-foreground">{reply.title}</span>
                    {reply.is_global && (
                      <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">Global</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{reply.content}</p>
                </div>
                {canEdit(reply) && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(reply)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(reply.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Resposta" : "Nova Resposta Rápida"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Título</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Saudação"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Atalho (opcional)</label>
              <Input
                value={form.shortcut}
                onChange={(e) => setForm({ ...form, shortcut: e.target.value })}
                placeholder="Ex: /ola"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Mensagem</label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Digite a mensagem..."
                rows={4}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={submitting || !form.title.trim() || !form.content.trim()}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span className="ml-1">Salvar</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuickReplies;

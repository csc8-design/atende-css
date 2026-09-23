import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ClosingReason {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  usage_count: number;
}

const ClosingReasons = () => {
  const [reasons, setReasons] = useState<ClosingReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClosingReason | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchReasons = async () => {
    const { data } = await supabase
      .from("closing_reasons" as any)
      .select("*")
      .order("name") as any;
    if (data) setReasons(data);
    setLoading(false);
  };

  useEffect(() => { fetchReasons(); }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    if (editing) {
      const { error } = await (supabase.from("closing_reasons" as any) as any)
        .update({ name: name.trim(), description: description.trim() || null })
        .eq("id", editing.id);
      if (error) toast.error("Erro ao atualizar");
      else toast.success("Motivo atualizado");
    } else {
      const { error } = await (supabase.from("closing_reasons" as any) as any)
        .insert({ name: name.trim(), description: description.trim() || null });
      if (error) toast.error("Erro ao criar motivo");
      else toast.success("Motivo criado");
    }
    setSubmitting(false);
    setDialogOpen(false);
    setEditing(null);
    setName("");
    setDescription("");
    fetchReasons();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase.from("closing_reasons" as any) as any).delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Motivo excluído"); fetchReasons(); }
  };

  const openEdit = (reason: ClosingReason) => {
    setEditing(reason);
    setName(reason.name);
    setDescription(reason.description || "");
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setDialogOpen(true);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Motivos de Finalização</h1>
          <p className="text-sm text-muted-foreground mt-1">Defina os motivos para encerrar conversas</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Novo Motivo
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : reasons.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum motivo cadastrado</p>
        ) : (
          reasons.map((reason) => (
            <div key={reason.id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
              <div>
                <h3 className="font-medium text-sm text-foreground">{reason.name}</h3>
                {reason.description && <p className="text-xs text-muted-foreground mt-0.5">{reason.description}</p>}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground">{reason.usage_count} usos</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(reason)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(reason.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Motivo" : "Novo Motivo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do motivo" />
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={submitting || !name.trim()}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span className="ml-1">Salvar</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClosingReasons;

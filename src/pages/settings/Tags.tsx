import { Plus, Edit2, Trash2 } from "lucide-react";

const tags = [
  { id: "1", name: "Lead", color: "#10b981", count: 45 },
  { id: "2", name: "Cliente", color: "#3b82f6", count: 128 },
  { id: "3", name: "VIP", color: "#f59e0b", count: 12 },
  { id: "4", name: "Lead Quente", color: "#ef4444", count: 23 },
  { id: "5", name: "Suporte", color: "#8b5cf6", count: 67 },
  { id: "6", name: "Seguidor", color: "#ec4899", count: 89 },
  { id: "7", name: "Parceiro", color: "#06b6d4", count: 8 },
  { id: "8", name: "Inativo", color: "#6b7280", count: 34 },
];

const Tags = () => {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Etiquetas</h1>
          <p className="text-sm text-muted-foreground mt-1">Organize seus contatos com etiquetas personalizadas</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          Nova Etiqueta
        </button>
      </div>

      <div className="grid gap-3">
        {tags.map((tag) => (
          <div key={tag.id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
              <span className="font-medium text-sm text-foreground">{tag.name}</span>
              <span className="text-xs text-muted-foreground">{tag.count} contatos</span>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
                <Edit2 className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Tags;

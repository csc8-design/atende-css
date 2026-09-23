import { Plus, Edit2, Trash2, Users } from "lucide-react";

const departments = [
  { id: "1", name: "Vendas", description: "Equipe de vendas e prospecção", members: 5, color: "bg-channel-whatsapp" },
  { id: "2", name: "Suporte", description: "Atendimento ao cliente e suporte técnico", members: 8, color: "bg-info" },
  { id: "3", name: "Financeiro", description: "Cobranças e pagamentos", members: 3, color: "bg-warning" },
  { id: "4", name: "Marketing", description: "Campanhas e comunicação", members: 4, color: "bg-channel-instagram" },
  { id: "5", name: "Pós-Venda", description: "Acompanhamento e fidelização", members: 3, color: "bg-primary" },
];

const Departments = () => {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Departamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Organize sua equipe em departamentos</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          Novo Departamento
        </button>
      </div>

      <div className="grid gap-4">
        {departments.map((dept) => (
          <div key={dept.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-3 h-10 rounded-full ${dept.color}`} />
                <div>
                  <h3 className="font-semibold text-foreground">{dept.name}</h3>
                  <p className="text-sm text-muted-foreground">{dept.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  {dept.members} membros
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Departments;

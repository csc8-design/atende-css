import { Save, Clock } from "lucide-react";

const days = [
  { name: "Segunda-feira", enabled: true, start: "09:00", end: "18:00" },
  { name: "Terça-feira", enabled: true, start: "09:00", end: "18:00" },
  { name: "Quarta-feira", enabled: true, start: "09:00", end: "18:00" },
  { name: "Quinta-feira", enabled: true, start: "09:00", end: "18:00" },
  { name: "Sexta-feira", enabled: true, start: "09:00", end: "18:00" },
  { name: "Sábado", enabled: false, start: "09:00", end: "13:00" },
  { name: "Domingo", enabled: false, start: "", end: "" },
];

const WorkSchedule = () => {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Jornada de Trabalho</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure os horários de atendimento da sua equipe</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Horário de Funcionamento
        </h3>

        <div className="space-y-3">
          {days.map((day) => (
            <div key={day.name} className="flex items-center gap-4 py-2">
              <div className="w-40">
                <span className="text-sm font-medium text-foreground">{day.name}</span>
              </div>
              <button className={`w-10 h-6 rounded-full relative transition-colors ${day.enabled ? "bg-primary" : "bg-muted"}`}>
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${day.enabled ? "right-1" : "left-1"}`} />
              </button>
              {day.enabled ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    defaultValue={day.start}
                    className="px-3 py-1.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                  <span className="text-sm text-muted-foreground">até</span>
                  <input
                    type="time"
                    defaultValue={day.end}
                    className="px-3 py-1.5 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Fechado</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-foreground">Mensagem Fora do Horário</h3>
        <textarea
          rows={3}
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground resize-none"
          defaultValue="Olá! No momento estamos fora do horário de atendimento. Retornaremos o mais breve possível no próximo dia útil. Obrigado!"
        />
      </div>

      <button className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
        <Save className="w-4 h-4" />
        Salvar Alterações
      </button>
    </div>
  );
};

export default WorkSchedule;

import { CreditCard, Check, ArrowRight } from "lucide-react";

const plans = [
  { name: "Starter", price: "R$ 99", period: "/mês", features: ["3 atendentes", "1.000 mensagens/mês", "WhatsApp apenas", "Chatbot básico"], current: false },
  { name: "Pro", price: "R$ 249", period: "/mês", features: ["10 atendentes", "10.000 mensagens/mês", "Todos os canais", "IA integrada", "CRM completo"], current: true },
  { name: "Enterprise", price: "R$ 599", period: "/mês", features: ["Ilimitado", "Mensagens ilimitadas", "Todos os canais", "IA avançada", "API completa", "Suporte dedicado"], current: false },
];

const BillingSettings = () => {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pagamento</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie seu plano e forma de pagamento</p>
      </div>

      {/* Current Plan */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Plano atual</p>
            <h3 className="text-xl font-bold text-foreground">Pro</h3>
            <p className="text-sm text-muted-foreground mt-1">Próxima cobrança: 15/04/2024 — R$ 249,00</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">R$ 249<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.name} className={`rounded-xl border p-5 transition-shadow ${plan.current ? "border-primary bg-primary/5 shadow-glow" : "border-border bg-card hover:shadow-sm"}`}>
            <h3 className="font-bold text-foreground">{plan.name}</h3>
            <p className="text-2xl font-bold text-foreground mt-2">{plan.price}<span className="text-sm font-normal text-muted-foreground">{plan.period}</span></p>
            <ul className="mt-4 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button className={`w-full mt-4 py-2 rounded-lg text-sm font-medium transition-opacity ${plan.current ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"}`}>
              {plan.current ? "Plano Atual" : "Fazer Upgrade"}
            </button>
          </div>
        ))}
      </div>

      {/* Payment Method */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          Forma de Pagamento
        </h3>
        <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-7 bg-background rounded border border-border flex items-center justify-center text-xs font-bold text-foreground">VISA</div>
            <div>
              <p className="text-sm font-medium text-foreground">•••• •••• •••• 4242</p>
              <p className="text-xs text-muted-foreground">Expira 12/2025</p>
            </div>
          </div>
          <button className="text-sm text-primary font-medium hover:underline">Alterar</button>
        </div>
      </div>
    </div>
  );
};

export default BillingSettings;

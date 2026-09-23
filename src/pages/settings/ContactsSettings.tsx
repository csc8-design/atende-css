import { Contact } from "lucide-react";

const ContactsSettings = () => {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Contatos</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure as opções de gestão de contatos</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h3 className="font-semibold text-foreground">Campos Personalizados</h3>
        {["CPF/CNPJ", "Empresa", "Cargo", "Cidade", "Origem do Lead"].map((field) => (
          <div key={field} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
            <span className="text-sm text-foreground">{field}</span>
            <button className="w-10 h-6 rounded-full bg-primary relative transition-colors">
              <div className="w-4 h-4 rounded-full bg-white absolute right-1 top-1" />
            </button>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-foreground">Importação</h3>
        <p className="text-sm text-muted-foreground">Importe contatos de um arquivo CSV ou Excel</p>
        <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
          <Contact className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Arraste um arquivo ou clique para selecionar</p>
          <p className="text-xs text-muted-foreground mt-1">CSV, XLS, XLSX (máx. 10MB)</p>
        </div>
      </div>
    </div>
  );
};

export default ContactsSettings;

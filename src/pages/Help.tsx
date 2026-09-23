import AppLayout from "@/components/layout/AppLayout";
import { HelpCircle, MessageSquare, Book, Video, ExternalLink } from "lucide-react";

const helpItems = [
  { icon: Book, title: "Documentação", desc: "Guias completos de uso da plataforma", link: "#" },
  { icon: Video, title: "Tutoriais em Vídeo", desc: "Aprenda assistindo passo a passo", link: "#" },
  { icon: MessageSquare, title: "Suporte por Chat", desc: "Fale com nossa equipe de suporte", link: "#" },
  { icon: HelpCircle, title: "FAQ", desc: "Perguntas frequentes", link: "#" },
];

const Help = () => {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Central de Ajuda</h1>
          <p className="text-sm text-muted-foreground mt-1">Como podemos ajudar?</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {helpItems.map((item) => (
            <a key={item.title} href={item.link} className="bg-card rounded-xl border border-border p-6 hover:shadow-md transition-shadow group">
              <item.icon className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground mb-1 flex items-center gap-1">
                {item.title}
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Help;

import AppLayout from "@/components/layout/AppLayout";
import MassCampaignsTab from "@/components/campaigns/MassCampaignsTab";
import MetaTemplateCampaignsTab from "@/components/campaigns/MetaTemplateCampaignsTab";
import { useState } from "react";
import { Zap, FileText } from "lucide-react";

const Campaigns = () => {
  const [tab, setTab] = useState<"mass" | "meta">("mass");

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campanhas</h1>
          <p className="text-sm text-muted-foreground mt-1">Disparos em massa personalizados ou via templates Meta</p>
        </div>

        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setTab("mass")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === "mass" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className="w-4 h-4" /> Disparo em Massa (Evolution)
          </button>
          <button
            onClick={() => setTab("meta")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === "meta" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="w-4 h-4" /> Templates Meta
          </button>
        </div>

        {tab === "mass" ? <MassCampaignsTab /> : <MetaTemplateCampaignsTab />}
      </div>
    </AppLayout>
  );
};

export default Campaigns;

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { Home, MessageSquare, ArrowRightLeft } from "lucide-react";

interface ChatbotConfig {
  id: string;
  name: string;
  department_id: string | null;
  welcome_message: string | null;
  is_active: boolean;
  transfer_keywords: string[];
  departments?: { name: string } | null;
}

interface Department {
  id: string;
  name: string;
}

/* Custom node components */
const MenuNode = ({ data }: { data: any }) => (
  <div className="bg-card border-2 border-primary/30 rounded-xl shadow-lg min-w-[260px]">
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-primary/5 rounded-t-xl">
      <Home className="w-4 h-4 text-primary" />
      <span className="text-sm font-bold text-foreground">{data.label}</span>
    </div>
    {data.message && (
      <div className="px-4 py-2 border-b border-border/50">
        <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Mensagem do menu</p>
        <p className="text-xs text-foreground leading-relaxed">{data.message}</p>
      </div>
    )}
    {data.options && data.options.length > 0 && (
      <div className="px-4 py-2">
        <p className="text-[10px] text-muted-foreground font-medium mb-1">Opções do menu</p>
        {data.options.map((opt: string, i: number) => (
          <div key={i} className="text-xs text-foreground py-1 border-b border-border/30 last:border-0">{opt}</div>
        ))}
      </div>
    )}
  </div>
);

const TransferNode = ({ data }: { data: any }) => (
  <div className="bg-destructive/90 text-destructive-foreground rounded-lg shadow-md min-w-[220px] px-4 py-3">
    <p className="text-xs font-bold">Transferência para departamento</p>
    <div className="flex items-center gap-1.5 mt-1">
      <ArrowRightLeft className="w-3 h-3" />
      <span className="text-[11px]">{data.label}</span>
    </div>
  </div>
);

const nodeTypes = {
  menu: MenuNode,
  transfer: TransferNode,
};

const ChatbotFlowDiagram = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    buildDiagram();
  }, []);

  const buildDiagram = async () => {
    const { data: configs } = await supabase
      .from("chatbot_configs")
      .select("*, departments(name)")
      .order("created_at", { ascending: true });

    const { data: departments } = await supabase
      .from("departments")
      .select("id, name")
      .eq("is_active", true);

    if (!configs || !departments) {
      setLoading(false);
      return;
    }

    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

    // Root node - Menu Inicial
    const rootConfig = configs.find((c) => c.name.toLowerCase().includes("inicial") || c.name.toLowerCase().includes("menu")) || configs[0];

    if (!rootConfig && configs.length === 0) {
      setLoading(false);
      return;
    }

    // Create root menu node
    flowNodes.push({
      id: "root",
      type: "menu",
      position: { x: 400, y: 0 },
      data: {
        label: rootConfig?.name || "Menu Inicial",
        message: rootConfig?.welcome_message || "Olá! Bem-vindo à ENGWE Brasil. Como posso ajudá-lo?",
        options: configs.filter((c) => c.id !== rootConfig?.id).map((c) => c.name.replace("Submenu ", "")),
      },
      sourcePosition: Position.Bottom,
    });

    // Create submenu nodes
    const submenus = configs.filter((c) => c.id !== rootConfig?.id);
    const spacing = 380;
    const startX = -(submenus.length - 1) * spacing / 2 + 400;

    submenus.forEach((config, idx) => {
      const x = startX + idx * spacing;
      const nodeId = `submenu-${config.id}`;

      // Get department options for this submenu
      const deptName = config.departments?.name || "";
      const parentDept = departments.find((d) => deptName && d.name.toLowerCase().includes(deptName.split("/")[0]?.trim().toLowerCase()));

      // Find related sub-departments
      const relatedDepts = departments.filter((d) => {
        if (!deptName) return false;
        const prefix = deptName.split("/")[0]?.trim().toLowerCase();
        return d.name.toLowerCase().includes(prefix);
      });

      const options = relatedDepts.length > 0
        ? relatedDepts.map((d) => d.name.split("/").pop()?.trim() || d.name)
        : config.transfer_keywords.slice(0, 3);

      flowNodes.push({
        id: nodeId,
        type: "menu",
        position: { x, y: 220 },
        data: {
          label: config.name,
          message: config.welcome_message || `Ótimo, seja bem vindo ao ${config.name.replace("Submenu ", "")}, selecione o assunto que você deseja:`,
          options,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      });

      // Edge from root to submenu
      flowEdges.push({
        id: `e-root-${nodeId}`,
        source: "root",
        target: nodeId,
        type: "smoothstep",
        style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" },
      });

      // Create transfer nodes for each department option
      const transferDepts = relatedDepts.length > 0 ? relatedDepts : (config.departments ? [{ id: config.department_id || "", name: deptName }] : []);

      transferDepts.forEach((dept, dIdx) => {
        const transferId = `transfer-${config.id}-${dept.id || dIdx}`;
        flowNodes.push({
          id: transferId,
          type: "transfer",
          position: { x: x - 20 + dIdx * 10, y: 520 + dIdx * 90 },
          data: { label: dept.name },
          targetPosition: Position.Top,
        });

        flowEdges.push({
          id: `e-${nodeId}-${transferId}`,
          source: nodeId,
          target: transferId,
          type: "smoothstep",
          style: { stroke: "hsl(var(--destructive))", strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--destructive))" },
        });
      });
    });

    // If no submenus, create transfer nodes directly from root
    if (submenus.length === 0 && rootConfig) {
      departments.slice(0, 4).forEach((dept, idx) => {
        const transferId = `transfer-root-${dept.id}`;
        flowNodes.push({
          id: transferId,
          type: "transfer",
          position: { x: 200 + idx * 300, y: 300 },
          data: { label: dept.name },
          targetPosition: Position.Top,
        });
        flowEdges.push({
          id: `e-root-${transferId}`,
          source: "root",
          target: transferId,
          type: "smoothstep",
          style: { stroke: "hsl(var(--destructive))", strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--destructive))" },
        });
      });
    }

    setNodes(flowNodes);
    setEdges(flowEdges);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Carregando diagrama...
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <Background gap={20} size={1} />
      </ReactFlow>
    </div>
  );
};

export default ChatbotFlowDiagram;

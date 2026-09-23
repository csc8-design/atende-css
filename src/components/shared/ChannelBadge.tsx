import { MessageSquare } from "lucide-react";

type Channel = "whatsapp" | "instagram" | "telegram" | "webchat";

const channelConfig: Record<Channel, { icon: string; className: string }> = {
  whatsapp: { icon: "W", className: "bg-channel-whatsapp text-white" },
  instagram: { icon: "I", className: "bg-channel-instagram text-white" },
  telegram: { icon: "T", className: "bg-primary text-primary-foreground" },
  webchat: { icon: "C", className: "bg-muted text-muted-foreground" },
};

interface ChannelBadgeProps {
  channel: Channel;
  size?: "sm" | "md";
}

const ChannelBadge = ({ channel, size = "sm" }: ChannelBadgeProps) => {
  const config = channelConfig[channel] || channelConfig.webchat;
  const sizeClass = size === "sm" ? "w-5 h-5 text-[10px]" : "w-6 h-6 text-xs";

  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center font-bold ${config.className}`}>
      {config.icon}
    </div>
  );
};

export default ChannelBadge;

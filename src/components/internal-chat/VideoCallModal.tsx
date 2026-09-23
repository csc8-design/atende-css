import { useEffect, useRef, useState } from "react";
import { X, Maximize2, Minimize2 } from "lucide-react";

interface VideoCallModalProps {
  roomName: string;
  displayName: string;
  onClose: () => void;
}

const VideoCallModal = ({ roomName, displayName, onClose }: VideoCallModalProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const jitsiUrl = `https://meet.jit.si/${roomName}#userInfo.displayName="${encodeURIComponent(displayName)}"&config.prejoinConfig.enabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&interfaceConfig.SHOW_JITSI_WATERMARK=false&interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false&interfaceConfig.DEFAULT_BACKGROUND='#1a1a2e'`;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "odata" && event.data?.action === "hangup") {
        onClose();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onClose]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div
      className={`fixed z-50 ${
        isFullscreen
          ? "inset-0"
          : "bottom-4 right-4 w-[480px] h-[380px] rounded-xl shadow-2xl border border-border"
      } bg-background flex flex-col overflow-hidden`}
    >
      {/* Header */}
      <div className="h-10 bg-card border-b border-border flex items-center justify-between px-3 flex-shrink-0">
        <span className="text-xs font-medium text-foreground truncate">
          📹 Videochamada em andamento
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleFullscreen}
            className="p-1 rounded hover:bg-secondary text-muted-foreground transition-colors"
            title={isFullscreen ? "Minimizar" : "Tela cheia"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Encerrar chamada"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {/* Jitsi iframe */}
      <iframe
        ref={iframeRef}
        src={jitsiUrl}
        className="flex-1 w-full"
        allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
        style={{ border: "none" }}
      />
    </div>
  );
};

export default VideoCallModal;

interface StatusDotProps {
  status: string;
}

const statusColors: Record<string, string> = {
  open: "bg-success",
  pending: "bg-warning",
  resolved: "bg-muted-foreground",
  closed: "bg-muted-foreground",
};

const StatusDot = ({ status }: StatusDotProps) => (
  <div className={`w-2 h-2 rounded-full ${statusColors[status] || "bg-muted-foreground"}`} />
);

export default StatusDot;

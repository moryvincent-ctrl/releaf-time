import { ReactNode } from "react";

interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value: string;
}

const KpiCard = ({ icon, label, value }: KpiCardProps) => (
  <div className="bg-card rounded-lg border border-border p-5">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-secondary">{icon}</span>
      <span className="label-uppercase">{label}</span>
    </div>
    <div className="text-2xl font-heading font-bold text-primary">{value}</div>
  </div>
);

export default KpiCard;

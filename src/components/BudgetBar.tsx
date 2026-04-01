interface BudgetBarProps {
  percent: number;
  showLabel?: boolean;
}

const BudgetBar = ({ percent, showLabel = true }: BudgetBarProps) => {
  const color =
    percent >= 100
      ? "bg-destructive"
      : percent >= 80
      ? "bg-[hsl(38,92%,50%)]"
      : "bg-secondary";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-xs font-semibold ${percent >= 100 ? "text-destructive" : percent >= 80 ? "text-[hsl(38,92%,50%)]" : "text-secondary"}`}>
          {percent}%
        </span>
      )}
    </div>
  );
};

export default BudgetBar;

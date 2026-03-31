import { Leaf } from "lucide-react";

const ReleafLogoWhite = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const sizes = {
    sm: { icon: 20, text: "text-lg" },
    md: { icon: 28, text: "text-2xl" },
    lg: { icon: 36, text: "text-3xl" },
  };

  const s = sizes[size];

  return (
    <div className="flex items-center gap-2">
      <Leaf size={s.icon} className="text-secondary" />
      <span className={`font-heading font-semibold text-sidebar-foreground ${s.text}`}>
        Releaf <span className="font-normal">Time</span>
      </span>
    </div>
  );
};

export default ReleafLogoWhite;

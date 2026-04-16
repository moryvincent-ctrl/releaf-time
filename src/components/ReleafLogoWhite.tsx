import releafLogo from "@/assets/releaf-logo-monochrome.svg";

const ReleafLogoWhite = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const sizes = {
    sm: "h-8",
    md: "h-10",
    lg: "h-14",
  };

  return <img src={releafLogo} alt="Releaf" className={sizes[size]} />;
};

export default ReleafLogoWhite;

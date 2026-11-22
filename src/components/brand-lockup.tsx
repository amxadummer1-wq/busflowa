import { BusFront } from "lucide-react";

type BrandLockupProps = {
  alignment?: "left" | "center";
  size?: "default" | "large";
};

export function BrandLockup({ alignment = "left", size = "default" }: BrandLockupProps) {
  const centered = alignment === "center";

  return (
    <div className={`flex ${centered ? "flex-col" : "items-center"} ${centered ? "items-center" : ""}`}>
      <div className={`flex items-center gap-2 ${centered ? "flex-col gap-3" : ""}`}>
        <span
          className={`grid shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground ${
            size === "large" ? "h-14 w-14" : "h-10 w-10"
          }`}
          aria-hidden="true"
        >
          <BusFront className={size === "large" ? "h-8 w-8" : "h-6 w-6"} strokeWidth={2.2} />
        </span>
        <span
          className={`font-display font-bold text-foreground ${
            size === "large" ? "text-3xl sm:text-4xl" : "text-xl"
          }`}
        >
          BUS <span className="text-primary">FLOW</span>
        </span>
      </div>
    </div>
  );
}
import {
  CircleEllipsis,
  Droplets,
  Fish,
  Landmark,
  Pill,
  Shield,
  Shovel,
  Sprout,
  Truck,
  Users,
  Wheat,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Icons a category can use (names stored in categories.icon). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  users: Users,
  wheat: Wheat,
  fish: Fish,
  sprout: Sprout,
  pill: Pill,
  landmark: Landmark,
  shovel: Shovel,
  wrench: Wrench,
  droplets: Droplets,
  truck: Truck,
  shield: Shield,
  ellipsis: CircleEllipsis,
};

export function CategoryIcon({
  icon,
  color,
  className,
  size = "md",
}: {
  icon: string;
  color: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = CATEGORY_ICONS[icon] ?? CircleEllipsis;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        size === "sm" && "size-7",
        size === "md" && "size-9",
        size === "lg" && "size-11",
        className,
      )}
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <Icon className={size === "sm" ? "size-4" : size === "md" ? "size-5" : "size-6"} />
    </span>
  );
}

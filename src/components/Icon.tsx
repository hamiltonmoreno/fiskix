import { cn } from "@/lib/utils";

interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

const SIZE_CLASSES: Record<NonNullable<IconProps["size"]>, string> = {
  xs: "text-base",
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
};

export function Icon({ name, className, filled = false, size = "md" }: IconProps) {
  return (
    <span
      className={cn(
        filled ? "material-symbols-filled" : "material-symbols-outlined",
        SIZE_CLASSES[size],
        className
      )}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

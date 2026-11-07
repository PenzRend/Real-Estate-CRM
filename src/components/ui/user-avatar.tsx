import { initials } from "@/lib/avatar";
import { cn } from "@/lib/cn";

const sizes = { xs: "size-6 text-[10px]", sm: "size-7 text-[11px]", md: "size-10 text-xs", lg: "size-11 text-sm", xl: "size-20 text-xl" } as const;

/** A member's picture, or their initials on a dark circle. */
export function UserAvatar({ name, url, size = "md", className }: { name: string; url?: string | null; size?: keyof typeof sizes; className?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- small, already sized at upload; no optimisation needed
    <img src={url} alt="" className={cn("shrink-0 rounded-full bg-surface object-cover", sizes[size], className)} />
  ) : (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full bg-primary font-medium text-white", sizes[size], className)}>
      {initials(name)}
    </span>
  );
}

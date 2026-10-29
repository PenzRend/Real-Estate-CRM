import { brandIcon } from "@/lib/brand-icon";

// The icon on an iPhone's home screen when Flavio is added there.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return brandIcon(180, true);
}

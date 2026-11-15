import type { ReactNode } from "react";
import { redirectIfPublicOnly } from "@/lib/public-only";

export default function GuestLayout({
  children,
}: {
  children: ReactNode;
}) {
  redirectIfPublicOnly();
  return children;
}

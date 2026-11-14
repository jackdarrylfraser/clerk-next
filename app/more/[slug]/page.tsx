import { redirect } from "next/navigation";

export const instant = false;

export default async function LegacyPublicArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/public/${encodeURIComponent(slug)}`);
}

import { redirect } from "next/navigation";

export const instant = false;

export default async function LegacyPublicTagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/public/tag/${encodeURIComponent(slug)}`);
}

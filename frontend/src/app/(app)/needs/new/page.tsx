import { NeedForm } from "@/features/needs/components/NeedForm";

export default async function NewNeedPage({
  searchParams,
}: {
  searchParams: Promise<{
    url?: string | string[];
    title?: string | string[];
    text?: string | string[];
  }>;
}) {
  const { url, title, text } = await searchParams;

  return (
    <NeedForm
      mode="create"
      sharedLink={url}
      sharedText={text}
      sharedTitle={title}
    />
  );
}

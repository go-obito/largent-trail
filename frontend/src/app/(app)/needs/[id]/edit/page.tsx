import { NeedForm } from "@/features/needs/components/NeedForm";

export default async function EditNeedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <NeedForm mode="edit" needId={id} />;
}

import { ConfirmTrainerForm } from "../setup-forms";
export default async function ConfirmTrainerPage({ searchParams }: { searchParams: Promise<{ finished?: string }> }) {
  const params = await searchParams;
  return <ConfirmTrainerForm finished={params.finished === "1"} />;
}

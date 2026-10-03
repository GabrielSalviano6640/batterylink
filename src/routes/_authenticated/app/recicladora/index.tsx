import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { RecicladorDashboard } from "@/components/dashboards/reciclador";

export const Route = createFileRoute("/_authenticated/app/recicladora/")({
  component: DashboardPage,
});

function DashboardPage() {
  const auth = useAuth();
  if (auth.loading || !auth.user) return null;
  return <RecicladorDashboard userId={auth.user.id} />;
}

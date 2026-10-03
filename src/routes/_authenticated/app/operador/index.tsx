import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { OperadorDashboard } from "@/components/dashboards/operador";

export const Route = createFileRoute("/_authenticated/app/operador/")({
  component: DashboardPage,
});

function DashboardPage() {
  const auth = useAuth();
  if (auth.loading || !auth.user) return null;
  return <OperadorDashboard userId={auth.user.id} />;
}

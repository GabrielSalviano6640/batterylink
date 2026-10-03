import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { GeradorDashboard } from "@/components/dashboards/gerador";

export const Route = createFileRoute("/_authenticated/app/gerador/")({
  component: DashboardPage,
});

function DashboardPage() {
  const auth = useAuth();
  if (auth.loading || !auth.user) return null;
  return <GeradorDashboard userId={auth.user.id} />;
}

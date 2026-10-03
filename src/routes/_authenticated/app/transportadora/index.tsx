import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { TransportadoraDashboard } from "@/components/dashboards/transportadora";

export const Route = createFileRoute("/_authenticated/app/transportadora/")({
  component: DashboardPage,
});

function DashboardPage() {
  const auth = useAuth();
  if (auth.loading || !auth.user) return null;
  return <TransportadoraDashboard userId={auth.user.id} />;
}

import { createFileRoute } from "@tanstack/react-router";
import { RequestsTab } from "../../app.admin";

export const Route = createFileRoute("/_authenticated/app/admin/pending-organizations")({
  component: RequestsTab,
});

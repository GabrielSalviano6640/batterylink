import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentType, ReactNode } from "react";

const state = vi.hoisted(() => ({
  pathname: "/app/gerador/bateria/nova",
  auth: {
    loading: false,
    user: { id: "user-1", email: "user@example.test" },
    role: "gerador",
    realRole: "gerador",
    roles: ["gerador"],
    status: "approved",
    hasPendingRequest: false,
    isDemo: false,
    refresh: async () => {},
  },
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => state.auth,
  setImpersonatedRole: vi.fn(),
  getImpersonatedRole: () => null,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useLocation: ({ select }: { select: (location: { pathname: string }) => unknown }) =>
    select({ pathname: state.pathname }),
  useNavigate: () => vi.fn(),
  Outlet: () => <div>CHILD_ROUTE</div>,
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/notifications-bell", () => ({ NotificationsBell: () => null }));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => null }));
vi.mock("@/components/dashboards/gerador", () => ({
  GeradorDashboard: () => <div>GENERATOR_DASHBOARD</div>,
}));
vi.mock("@/components/dashboards/operador", () => ({
  OperadorDashboard: () => <div>OPERATOR_DASHBOARD</div>,
}));
vi.mock("@/components/dashboards/reciclador", () => ({
  RecicladorDashboard: () => <div>RECYCLER_DASHBOARD</div>,
}));
vi.mock("@/components/dashboards/transportadora", () => ({
  TransportadoraDashboard: () => <div>CARRIER_DASHBOARD</div>,
}));
vi.mock("@/components/admin/control-center", () => ({
  AdminControlCenter: () => <div>ADMIN_CONTROL</div>,
}));
vi.mock("@/components/admin/reports", () => ({ ReportsTab: () => null, AuditTab: () => null }));

import { Route as AppRoute } from "../src/routes/_authenticated/app";
import { Route as AdminRoute } from "../src/routes/_authenticated/app.admin";
import { Route as GeneratorRoute } from "../src/routes/_authenticated/app/gerador/index";
import { Route as OperatorRoute } from "../src/routes/_authenticated/app/operador/index";
import { Route as RecyclerRoute } from "../src/routes/_authenticated/app/recicladora/index";
import { Route as CarrierRoute } from "../src/routes/_authenticated/app/transportadora/index";

function render(route: { options: { component?: unknown } }) {
  const Component = route.options.component as ComponentType;
  return renderToStaticMarkup(<Component />);
}
beforeEach(() => {
  state.pathname = "/app/gerador/bateria/nova";
  Object.assign(state.auth, {
    role: "gerador",
    realRole: "gerador",
    roles: ["gerador"],
    status: "approved",
  });
});
describe("app layout rendering and access", () => {
  it("renders child pages instead of replacing them with the hub dashboard", () => {
    expect(render(AppRoute)).toContain("CHILD_ROUTE");
    expect(render(AppRoute)).not.toContain("GENERATOR_DASHBOARD");
  });
  it("keeps the existing dashboard at /app", () => {
    state.pathname = "/app";
    expect(render(AppRoute)).toContain("GENERATOR_DASHBOARD");
    expect(render(AppRoute)).not.toContain("CHILD_ROUTE");
  });
  it.each(["pending", "suspended", "rejected"])(
    "does not render operations for a %s account",
    (status) => {
      state.auth.status = status;
      expect(render(AppRoute)).not.toContain("CHILD_ROUTE");
    },
  );
  it("does not render the admin route for a generator", () => {
    state.pathname = "/app/admin";
    expect(render(AppRoute)).toContain("Seu perfil não tem acesso");
    expect(render(AdminRoute)).not.toContain("ADMIN_CONTROL");
  });
  it("renders pending organizations through the admin outlet", () => {
    Object.assign(state.auth, { role: "admin", realRole: "admin", roles: ["admin"] });
    state.pathname = "/app/admin/pending-organizations";
    expect(render(AppRoute)).toContain("CHILD_ROUTE");
    expect(render(AdminRoute)).toContain("CHILD_ROUTE");
  });
  it.each([
    [GeneratorRoute, "GENERATOR_DASHBOARD"],
    [OperatorRoute, "OPERATOR_DASHBOARD"],
    [RecyclerRoute, "RECYCLER_DASHBOARD"],
    [CarrierRoute, "CARRIER_DASHBOARD"],
  ])("reuses canonical dashboard components", (route, marker) => {
    expect(render(route as typeof GeneratorRoute)).toContain(marker);
  });
});

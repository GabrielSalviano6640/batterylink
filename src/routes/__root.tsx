import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-industrial px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs text-brand tracking-widest uppercase mb-4">Erro 404</p>
        <h1 className="text-5xl font-display font-bold text-foreground">Rota não localizada</h1>
        <p className="mt-4 text-sm text-slate-400">
          O recurso que você tentou acessar não existe ou foi removido do sistema.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-industrial hover:brightness-110 transition"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-industrial px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-display font-semibold text-foreground">
          Falha ao carregar esta página
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Ocorreu um erro no sistema. Tente novamente ou retorne ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-industrial hover:brightness-110 transition"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-white/20 px-4 py-2 text-sm text-foreground hover:bg-white/5 transition"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BatteryLink Brasil — Rastreabilidade e destinação inteligente para baterias EV" },
      {
        name: "description",
        content:
          "Plataforma B2B para rastreabilidade, triagem, logística reversa e destinação de baterias de veículos elétricos, frotas e sistemas de armazenamento de energia.",
      },
      { name: "author", content: "BatteryLink Brasil" },
      {
        property: "og:title",
        content: "BatteryLink Brasil — Baterias EV com destinação inteligente",
      },
      {
        property: "og:description",
        content:
          "Rastreabilidade, triagem, segunda vida e reciclagem para baterias industriais e de veículos elétricos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="dark" position="top-right" />
    </QueryClientProvider>
  );
}

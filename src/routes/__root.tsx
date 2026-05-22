import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display text-foreground">404</h1>
        <Link to="/" className="mt-6 inline-block glass px-6 py-2 rounded-full text-foreground">Go home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 glass px-6 py-2 rounded-full"
        >Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Glassbird — Liquid Flappy" },
      { name: "description", content: "A liquid glass take on flappy bird with smooth physics and a dreamy UI." },
      { name: "theme-color", content: "#1a1530" },
      { property: "og:title", content: "Glassbird — Liquid Flappy" },
      { name: "twitter:title", content: "Glassbird — Liquid Flappy" },
      { property: "og:description", content: "A liquid glass take on flappy bird with smooth physics and a dreamy UI." },
      { name: "twitter:description", content: "A liquid glass take on flappy bird with smooth physics and a dreamy UI." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/05f93faa-f6d1-4421-8487-ce0c26ffccd3/id-preview-55c9b6f1--5f41ab16-0291-49ed-a4c5-18eb640f2001.lovable.app-1779369558912.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/05f93faa-f6d1-4421-8487-ce0c26ffccd3/id-preview-55c9b6f1--5f41ab16-0291-49ed-a4c5-18eb640f2001.lovable.app-1779369558912.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}

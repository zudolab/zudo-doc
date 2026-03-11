import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, Outlet } from "react-router-dom";
import "./styles/global.css";

/* ── Pattern page imports ── */
import SidebarsPage from "./pages/sidebars";
import ComponentsPage from "./pages/components";
import HeadersPage from "./pages/headers";
import BreadcrumbsPage from "./pages/breadcrumbs";

function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-muted px-hsp-xl py-vsp-sm flex gap-hsp-xl items-center">
        <Link to="/" className="text-heading font-bold text-accent">
          CSS Playground
        </Link>
        <div className="flex gap-hsp-lg text-small">
          <Link to="/sidebars" className="text-muted hover:text-fg">
            Sidebars
          </Link>
          <Link to="/components" className="text-muted hover:text-fg">
            Components
          </Link>
          <Link to="/headers" className="text-muted hover:text-fg">
            Headings
          </Link>
          <Link to="/breadcrumbs" className="text-muted hover:text-fg">
            Breadcrumbs
          </Link>
        </div>
      </nav>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

function Home() {
  const categories = [
    {
      title: "Sidebars",
      path: "/sidebars",
      count: 30,
      desc: "Navigation sidebar layout patterns",
    },
    {
      title: "Components",
      path: "/components",
      count: 20,
      desc: "Base HTML component patterns (h1, description, etc.)",
    },
    {
      title: "Headings",
      path: "/headers",
      count: 30,
      desc: "Heading typography patterns (h2 / h3 / h4)",
    },
    {
      title: "Breadcrumbs",
      path: "/breadcrumbs",
      count: 20,
      desc: "Breadcrumb navigation patterns",
    },
  ];

  return (
    <div className="px-hsp-xl py-vsp-xl max-w-[960px] mx-auto">
      <h1 className="text-display font-bold mb-vsp-lg">Design Patterns</h1>
      <p className="text-muted mb-vsp-xl text-subheading">
        A collection of CSS design patterns using zudo-doc's token system.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-hsp-xl">
        {categories.map((cat) => (
          <Link
            key={cat.path}
            to={cat.path}
            className="block border border-muted rounded-lg p-hsp-xl hover:border-accent group"
          >
            <h2 className="text-subheading font-semibold group-hover:text-accent">
              {cat.title}
              <span className="text-small text-muted ml-hsp-sm">
                ({cat.count})
              </span>
            </h2>
            <p className="text-small text-muted mt-vsp-xs">{cat.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="sidebars" element={<SidebarsPage />} />
          <Route path="components" element={<ComponentsPage />} />
          <Route path="headers" element={<HeadersPage />} />
          <Route path="breadcrumbs" element={<BreadcrumbsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);

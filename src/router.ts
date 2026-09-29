// Hash routing: the export is static, so the URL fragment carries the page.
// "#/" home, "#/project/<id>" project, "#/hive" the HIVE example, "#/about" rules.

import { useEffect, useState } from "react";

export type Route = { page: "home" } | { page: "project"; id: string } | { page: "about" };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, "");
  if (h.startsWith("/project/")) return { page: "project", id: decodeURIComponent(h.slice("/project/".length)) };
  if (h === "/hive") return { page: "project", id: "hive" };
  if (h === "/about") return { page: "about" };
  return { page: "home" };
}

export function hrefFor(route: Route): string {
  if (route.page === "project") return route.id === "hive" ? "#/hive" : `#/project/${encodeURIComponent(route.id)}`;
  if (route.page === "about") return "#/about";
  return "#/";
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
      // Move focus to the main landmark so keyboard and screen-reader users
      // continue from the new page, not from the link they activated.
      window.setTimeout(() => document.getElementById("main")?.focus({ preventScroll: true }), 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function navigate(route: Route): void {
  window.location.hash = hrefFor(route);
}

import { useDashboard } from "./data/store";
import { AboutPage } from "./pages/AboutPage";
import { HomePage } from "./pages/HomePage";
import { ProjectPage } from "./pages/ProjectPage";
import { hrefFor, useRoute } from "./router";
import { SAFETY_LINE, SITE_NAME, TAGLINE } from "./copy";

export function App() {
  const route = useRoute();
  const dash = useDashboard();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container">
          <a className="brand" href="#/" aria-label="SWARM ALPHA home">
            <img src="./favicon.svg" alt="" width={32} height={32} />
            <span>
              <span className="brand-name">{SITE_NAME}</span>
              <span className="brand-tag">{TAGLINE}</span>
            </span>
          </a>
          <nav className="site-nav" aria-label="Main">
            <a href="#/" aria-current={route.page === "home" ? "page" : undefined}>
              Projects
            </a>
            <a href={hrefFor({ page: "project", id: "hive" })} aria-current={route.page === "project" && route.id === "hive" ? "page" : undefined}>
              HIVE example
            </a>
            <a href="#/about" aria-current={route.page === "about" ? "page" : undefined}>
              Scoring and sources
            </a>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <div className="container">
          {route.page === "home" ? <HomePage dash={dash} /> : null}
          {route.page === "project" ? <ProjectPage dash={dash} id={route.id} /> : null}
          {route.page === "about" ? <AboutPage dash={dash} /> : null}
        </div>
      </main>
      <footer className="site-footer">
        <div className="container">
          <p>
            <strong>{SAFETY_LINE}</strong>
          </p>
          <p>
            Sources: IdentityMD API and Explorer, Ethereum and Robinhood Chain public nodes, IPFS and GitHub. Live data refreshes every 10 seconds while the page is open. Nothing here needs a login or a wallet.
          </p>
        </div>
      </footer>
    </>
  );
}

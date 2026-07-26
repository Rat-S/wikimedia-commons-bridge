import React, { useEffect, useState } from "react";
import { Sun, Moon, Info, Shield, ExternalLink } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    // Default to dark mode
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Navigation Header */}
      <header
        style={{
          borderBottom: "1px solid var(--border-color)",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--bg-secondary)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Shield size={28} color="var(--accent-wikimedia)" />
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              Wikimedia Commons Bridge
            </h1>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
              Upload Google Photos to Commons
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <a
            href="https://wikimedia-bridge.covai.org/"
            target="_blank"
            rel="noreferrer"
            style={{
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.85rem",
              textDecoration: "none",
            }}
            title="About & Privacy Policy"
          >
            <ExternalLink size={16} />
            <span>About</span>
          </a>

          <a
            href="https://github.com/Rat-S/wikimedia-commons-bridge"
            target="_blank"
            rel="noreferrer"
            style={{
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.85rem",
              textDecoration: "none",
            }}
            title="GitHub Repository"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
              <path d="M9 18c-4.51 2-5-2-7-2"></path>
            </svg>
            <span>GitHub</span>
          </a>

          {/* Light/Dark mode toggler */}
          <button
            onClick={toggleTheme}
            style={{
              background: "none",
              color: "var(--text-secondary)",
              padding: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              border: "none",
            }}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: "32px 16px", maxWidth: "1200px", width: "100%", margin: "0 auto" }}>
        {children}
      </main>

      {/* Page Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border-color)",
          padding: "24px 16px",
          textAlign: "center",
          background: "var(--bg-secondary)",
          color: "var(--text-muted)",
          fontSize: "0.85rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <Info size={16} />
          <span>Open-source community tool hosted on Wikimedia Toolforge.</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <a href="https://wikimedia-bridge.covai.org/" target="_blank" rel="noreferrer" style={{ color: "var(--text-secondary)", textDecoration: "underline" }}>
            About & Privacy Policy
          </a>
          <span>•</span>
          <a href="https://github.com/Rat-S/wikimedia-commons-bridge" target="_blank" rel="noreferrer" style={{ color: "var(--text-secondary)", textDecoration: "underline" }}>
            GitHub Repository
          </a>
          <span>•</span>
          <a href="https://commons.wikimedia.org/wiki/Commons:Policies_and_guidelines" target="_blank" rel="noreferrer" style={{ color: "var(--text-secondary)", textDecoration: "underline" }}>
            Commons Policies
          </a>
        </div>
      </footer>
    </div>
  );
};

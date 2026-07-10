import React, { useEffect, useState } from "react";
import { Sun, Moon, Info, Shield } from "lucide-react";

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
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <Info size={16} />
          <span>Open-source community tool hosted on Wikimedia Toolforge.</span>
        </div>
        <p>
          Subject to <a href="https://commons.wikimedia.org/wiki/Commons:Policies_and_guidelines" target="_blank" rel="noreferrer">Commons policies</a> and Google API terms of use.
        </p>
      </footer>
    </div>
  );
};

import React from "react";
import { CheckCircle2, XCircle, LogOut, Image, Award } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

interface AuthStatusProps {
  googleConnected: boolean;
  wikimediaConnected: boolean;
  wikimediaUsername: string | null;
  onDisconnectGoogle: () => void;
  onDisconnectWikimedia: () => void;
}

export const AuthStatus: React.FC<AuthStatusProps> = ({
  googleConnected,
  wikimediaConnected,
  wikimediaUsername,
  onDisconnectGoogle,
  onDisconnectWikimedia,
}) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "24px",
        marginBottom: "32px",
      }}
    >
      {/* Google Photos Connection Card */}
      <div className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Image size={24} color={googleConnected ? "var(--accent-google)" : "var(--text-muted)"} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)" }}>Google Photos</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Access selected library media</p>
            </div>
          </div>

          <span
            style={{
              padding: "4px 10px",
              borderRadius: "20px",
              fontSize: "0.75rem",
              fontWeight: 600,
              background: googleConnected ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
              color: googleConnected ? "var(--success)" : "var(--danger)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            {googleConnected ? (
              <>
                <CheckCircle2 size={12} /> Connected
              </>
            ) : (
              <>
                <XCircle size={12} /> Disconnected
              </>
            )}
          </span>
        </div>

        <div style={{ marginTop: "auto" }}>
          {googleConnected ? (
            <button
              onClick={onDisconnectGoogle}
              style={{
                width: "100%",
                padding: "10px",
                background: "rgba(239, 68, 68, 0.1)",
                color: "var(--danger)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
              className="disconnect-btn"
            >
              <LogOut size={16} /> Disconnect Google
            </button>
          ) : (
            <a
              href={`${API_BASE_URL}/auth/google/login`}
              style={{
                display: "flex",
                width: "100%",
                padding: "10px",
                backgroundColor: "var(--accent-google)",
                color: "white",
                borderRadius: "var(--radius-md)",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                textDecoration: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-google-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-google)")}
            >
              Connect Google Photos
            </a>
          )}
        </div>
      </div>

      {/* Wikimedia Commons Connection Card */}
      <div className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Award size={24} color={wikimediaConnected ? "var(--accent-wikimedia)" : "var(--text-muted)"} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)" }}>Wikimedia Commons</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {wikimediaConnected ? `Authenticated as ${wikimediaUsername}` : "Authorize edits and file uploads"}
              </p>
            </div>
          </div>

          <span
            style={{
              padding: "4px 10px",
              borderRadius: "20px",
              fontSize: "0.75rem",
              fontWeight: 600,
              background: wikimediaConnected ? "rgba(59, 130, 246, 0.1)" : "rgba(239, 68, 68, 0.1)",
              color: wikimediaConnected ? "var(--accent-wikimedia)" : "var(--danger)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            {wikimediaConnected ? (
              <>
                <CheckCircle2 size={12} /> Connected
              </>
            ) : (
              <>
                <XCircle size={12} /> Disconnected
              </>
            )}
          </span>
        </div>

        <div style={{ marginTop: "auto" }}>
          {wikimediaConnected ? (
            <button
              onClick={onDisconnectWikimedia}
              style={{
                width: "100%",
                padding: "10px",
                background: "rgba(239, 68, 68, 0.1)",
                color: "var(--danger)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <LogOut size={16} /> Disconnect Wikimedia
            </button>
          ) : (
            <a
              href={`${API_BASE_URL}/auth/wikimedia/login`}
              style={{
                display: "flex",
                width: "100%",
                padding: "10px",
                backgroundColor: "var(--accent-wikimedia)",
                color: "white",
                borderRadius: "var(--radius-md)",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                textDecoration: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-wikimedia-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-wikimedia)")}
            >
              Connect Wikimedia Commons
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

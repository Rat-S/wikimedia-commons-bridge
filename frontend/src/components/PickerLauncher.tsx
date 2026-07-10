import React, { useState, useEffect, useRef } from "react";
import { api, MediaItem } from "../api/client";
import { FolderHeart, Loader2, Sparkles, AlertCircle } from "lucide-react";

interface PickerLauncherProps {
  googleConnected: boolean;
  onMediaSelected: (items: MediaItem[]) => void;
}

export const PickerLauncher: React.FC<PickerLauncherProps> = ({ googleConnected, onMediaSelected }) => {
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const pollIntervalRef = useRef<number | null>(null);
  const popupRef = useRef<Window | null>(null);

  useEffect(() => {
    // Cleanup polling interval on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const launchPicker = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Create Picker Session
      const session = await api.createPickerSession();
      const { picker_session_id, picker_uri } = session;

      // 2. Open Google native picker in a popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        picker_uri,
        "GooglePhotosPicker",
        `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes`
      );

      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        throw new Error("Popup blocker active. Please enable popups for this website to connect Google Photos Picker.");
      }

      popupRef.current = popup;
      setPolling(true);

      // 3. Start Polling Loop
      pollIntervalRef.current = window.setInterval(async () => {
        // If popup was closed manually by the user, stop polling
        if (popupRef.current && popupRef.current.closed) {
          stopPolling();
          setLoading(false);
          setError("Selection window was closed before completing.");
          return;
        }

        try {
          const pollResult = await api.pollPickerSession(picker_session_id);
          if (pollResult.ready) {
            stopPolling();
            // Automatically close popup if not already closed
            if (popupRef.current) {
              popupRef.current.close();
            }
            
            // 4. Fetch the selected media items
            const mediaResponse = await api.getPickedMedia(picker_session_id);
            onMediaSelected(mediaResponse.media_items);
            setLoading(false);
          }
        } catch (pollErr) {
          logger.error("Polling error:", pollErr);
        }
      }, 2000); // Poll every 2 seconds

    } catch (err: any) {
      logger.error("Failed to launch Google Photos picker:", err);
      setError(err.message || "Failed to initialize selection session.");
      setLoading(false);
    }
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setPolling(false);
  };

  return (
    <div
      className="glass-panel animate-fade-in"
      style={{
        padding: "40px 24px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "24px",
        background: "linear-gradient(135deg, var(--bg-card) 0%, hsl(222, 47%, 14%) 100%)",
        border: "1px dashed var(--border-color)",
        marginBottom: "32px",
      }}
    >
      <div
        style={{
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background: "hsla(212, 100%, 55%, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--accent-wikimedia)",
        }}
      >
        <FolderHeart size={40} />
      </div>

      <div style={{ maxWidth: "500px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
          Ready to transfer media?
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
          Select up to 2,000 photos and videos in Google's secure portal, then import them directly to Wikimedia Commons with metadata curation.
        </p>
      </div>

      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(239, 68, 68, 0.1)",
            color: "var(--danger)",
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            fontSize: "0.9rem",
            maxWidth: "500px",
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <button
        disabled={!googleConnected || loading}
        onClick={launchPicker}
        style={{
          padding: "14px 28px",
          backgroundColor: googleConnected ? "var(--accent-wikimedia)" : "var(--bg-input)",
          color: googleConnected ? "white" : "var(--text-muted)",
          cursor: googleConnected && !loading ? "pointer" : "not-allowed",
          fontWeight: 600,
          fontSize: "1.05rem",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          boxShadow: googleConnected ? "0 4px 14px var(--border-glow)" : "none",
        }}
        onMouseEnter={(e) => {
          if (googleConnected && !loading) e.currentTarget.style.backgroundColor = "var(--accent-wikimedia-hover)";
        }}
        onMouseLeave={(e) => {
          if (googleConnected && !loading) e.currentTarget.style.backgroundColor = "var(--accent-wikimedia)";
        }}
      >
        {loading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            {polling ? "Selecting photos..." : "Initializing..."}
          </>
        ) : (
          <>
            <Sparkles size={20} />
            Launch Google Photo Picker
          </>
        )}
      </button>

      {!googleConnected && (
        <p style={{ fontSize: "0.8rem", color: "var(--danger)" }}>
          * Please connect your Google Photos account above to enable selection.
        </p>
      )}
    </div>
  );
};

// Simple global logger fallback
const logger = {
  error: (...args: any[]) => console.error("[PickerLauncher]", ...args),
};

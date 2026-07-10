import { useState, useEffect } from "react";
import { api, MediaItem } from "./api/client";
import { Layout } from "./components/Layout";
import { AuthStatus } from "./components/AuthStatus";
import { PickerLauncher } from "./components/PickerLauncher";
import { MetadataEditor, CuratedMediaItem } from "./components/MetadataEditor";
import { UploadQueue } from "./components/UploadQueue";
import { Loader2, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";

type AppStep = "auth" | "picker" | "curate" | "uploading";

function App() {
  const [step, setStep] = useState<AppStep>("auth");
  const [loading, setLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [wikimediaConnected, setWikimediaConnected] = useState(false);
  const [wikimediaUsername, setWikimediaUsername] = useState<string | null>(null);
  
  const [selectedMedia, setSelectedMedia] = useState<MediaItem[]>([]);
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load Status and parse URL Redirect parameters
  useEffect(() => {
    const initAuth = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // 1. Process URL redirects callback parameters
        const params = new URLSearchParams(window.location.search);
        const urlError = params.get("error");
        const urlDetails = params.get("details");
        const googleStatusParam = params.get("google");
        const wikimediaStatusParam = params.get("wikimedia");
        const usernameParam = params.get("username");

        if (urlError) {
          setErrorMsg(`Authorization failed: ${urlDetails || urlError}`);
        }

        // 2. Fetch fresh API states
        const gStatus = await api.getGoogleStatus();
        const wStatus = await api.getWikimediaStatus();

        // Apply URL parameters override if fresh callback just completed
        const isGoogleConnected = gStatus.connected || googleStatusParam === "connected";
        const isWikiConnected = wStatus.connected || wikimediaStatusParam === "connected";
        const wikiUser = usernameParam || wStatus.username;

        setGoogleConnected(isGoogleConnected);
        setWikimediaConnected(isWikiConnected);
        setWikimediaUsername(wikiUser);

        // Transition steps depending on authentication
        if (isGoogleConnected && isWikiConnected) {
          setStep("picker");
        } else {
          setStep("auth");
        }

        // 3. Clear URL query parameters from address bar to keep it clean
        if (window.location.search) {
          const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.replaceState({ path: newUrl }, "", newUrl);
        }
      } catch (err) {
        console.error("Failed to initialize authentication status:", err);
        setErrorMsg("Failed to connect to backend server. Make sure the API service is running.");
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const handleDisconnectGoogle = async () => {
    try {
      await api.disconnectGoogle();
      setGoogleConnected(false);
      setStep("auth");
    } catch (err) {
      console.error("Disconnect Google error:", err);
    }
  };

  const handleDisconnectWikimedia = async () => {
    try {
      await api.disconnectWikimedia();
      setWikimediaConnected(false);
      setWikimediaUsername(null);
      setStep("auth");
    } catch (err) {
      console.error("Disconnect Wikimedia error:", err);
    }
  };

  const handleMediaSelected = (items: MediaItem[]) => {
    setSelectedMedia(items);
    if (items.length > 0) {
      setStep("curate");
    }
  };

  const handleUploadSubmit = async (curatedItems: CuratedMediaItem[]) => {
    setStep("uploading");
    setLoading(true);
    
    const ids: string[] = [];
    try {
      for (const item of curatedItems) {
        const uploadResponse = await api.startUploadJob({
          media_url: item.base_url,
          commons_filename: item.commons_filename,
          description: item.description,
          date: item.date,
          license_code: item.license_code,
          categories: item.categories
        });
        ids.push(uploadResponse.job_id);
      }
      setJobIds(ids);
    } catch (err: any) {
      console.error("Failed to queue uploads:", err);
      setErrorMsg(err.message || "Failed to start upload pipeline.");
      setStep("curate");
    } finally {
      setLoading(false);
    }
  };

  const resetToDashboard = () => {
    setSelectedMedia([]);
    setJobIds([]);
    setStep("picker");
  };

  if (loading && step === "auth") {
    return (
      <Layout>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", minHeight: "300px" }}>
          <Loader2 size={36} className="animate-spin" color="var(--accent-wikimedia)" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Alert Banner for Errors */}
      {errorMsg && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid var(--danger)",
            color: "var(--danger)",
            padding: "16px",
            borderRadius: "var(--radius-lg)",
            marginBottom: "24px",
            fontSize: "0.95rem"
          }}
          className="animate-fade-in"
        >
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
          <button 
            onClick={() => setErrorMsg(null)}
            style={{ marginLeft: "auto", background: "none", color: "var(--danger)", fontWeight: 700 }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* STEP 1: Authentication Connection Hub */}
      {step === "auth" && (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "32px", maxWidth: "800px", margin: "0 auto", width: "100%" }}>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "2rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
              Connect Accounts
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "1.05rem" }}>
              To begin moving photos, sign in with your Google Photos account and your Wikimedia Commons account below.
            </p>
          </div>

          <AuthStatus
            googleConnected={googleConnected}
            wikimediaConnected={wikimediaConnected}
            wikimediaUsername={wikimediaUsername}
            onDisconnectGoogle={handleDisconnectGoogle}
            onDisconnectWikimedia={handleDisconnectWikimedia}
          />

          {googleConnected && wikimediaConnected && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "16px" }}>
              <button
                onClick={() => setStep("picker")}
                style={{
                  padding: "14px 28px",
                  backgroundColor: "var(--accent-wikimedia)",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "1.05rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 14px var(--border-glow)"
                }}
              >
                Continue to Dashboard <ArrowRight size={18} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Dashboard/Launcher */}
      {step === "picker" && (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "32px", width: "100%" }}>
          <AuthStatus
            googleConnected={googleConnected}
            wikimediaConnected={wikimediaConnected}
            wikimediaUsername={wikimediaUsername}
            onDisconnectGoogle={handleDisconnectGoogle}
            onDisconnectWikimedia={handleDisconnectWikimedia}
          />
          
          <div style={{ display: "flex", gap: "12px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid hsla(142, 70%, 45%, 0.3)", padding: "16px", borderRadius: "var(--radius-lg)" }}>
            <ShieldCheck size={24} color="var(--success)" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: "0.9rem" }}>
              <strong style={{ color: "var(--text-primary)", display: "block" }}>Double OAuth Active</strong>
              <span style={{ color: "var(--text-secondary)" }}>
                You are authenticated as <strong style={{ color: "var(--text-primary)" }}>{wikimediaUsername}</strong> on Wikimedia. Ready to load Picker API.
              </span>
            </div>
          </div>

          <PickerLauncher
            googleConnected={googleConnected}
            onMediaSelected={handleMediaSelected}
          />
        </div>
      )}

      {/* STEP 3: Curation Curation Wizard */}
      {step === "curate" && (
        <MetadataEditor
          selectedItems={selectedMedia}
          onUploadSubmit={handleUploadSubmit}
          onCancel={resetToDashboard}
          wikimediaUsername={wikimediaUsername || "Anonymous"}
        />
      )}

      {/* STEP 4: Live Uploading Queue */}
      {step === "uploading" && (
        <div style={{ maxWidth: "800px", margin: "0 auto", width: "100%" }}>
          {loading ? (
            <div className="glass-panel" style={{ padding: "40px", textAlign: "center" }}>
              <Loader2 size={36} className="animate-spin" color="var(--accent-wikimedia)" style={{ margin: "0 auto 16px" }} />
              <p>Queueing your files on the background uploader...</p>
            </div>
          ) : (
            <UploadQueue
              jobIds={jobIds}
              onDone={resetToDashboard}
            />
          )}
        </div>
      )}
    </Layout>
  );
}

export default App;

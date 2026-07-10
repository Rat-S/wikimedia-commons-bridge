import React, { useState, useEffect, useRef } from "react";
import { api } from "../api/client";
import type { UploadStatusResponse } from "../api/client";
import confetti from "canvas-confetti";
import { CheckCircle2, XCircle, Loader2, ExternalLink, RefreshCw, Sparkles } from "lucide-react";

interface UploadQueueProps {
  jobIds: string[];
  onDone: () => void;
}

export const UploadQueue: React.FC<UploadQueueProps> = ({ jobIds, onDone }) => {
  const [jobs, setJobs] = useState<Record<string, UploadStatusResponse>>({});
  const [pollingActive, setPollingActive] = useState(true);
  const pollTimerRef = useRef<number | null>(null);

  // Initialize jobs map
  useEffect(() => {
    const initialJobs: Record<string, UploadStatusResponse> = {};
    jobIds.forEach((id) => {
      initialJobs[id] = {
        job_id: id,
        filename: "Pending...",
        status: "queued",
        progress_bytes: 0,
        total_bytes: 0,
        error: null,
        description_url: null,
        url: null,
      };
    });
    setJobs(initialJobs);
    setPollingActive(true);
  }, [jobIds]);

  // Polling Loop
  useEffect(() => {
    if (!pollingActive || jobIds.length === 0) return;

    const poll = async () => {
      let allFinished = true;
      const updatedJobs = { ...jobs };

      for (const id of jobIds) {
        const currentJob = jobs[id];
        // Only poll if the job is not in a terminal state
        if (!currentJob || currentJob.status === "queued" || currentJob.status === "uploading") {
          try {
            const statusData = await api.getUploadStatus(id);
            updatedJobs[id] = statusData;
            
            if (statusData.status === "queued" || statusData.status === "uploading") {
              allFinished = false;
            }
          } catch (err) {
            console.error(`Failed to poll status for job ${id}:`, err);
            allFinished = false;
          }
        }
      }

      setJobs(updatedJobs);

      if (allFinished) {
        setPollingActive(false);
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        
        // Trigger confetti celebration if any job succeeded!
        const succeeded = Object.values(updatedJobs).some((j) => j.status === "success");
        if (succeeded) {
          triggerConfettiCelebration();
        }
      }
    };

    // Run first poll immediately
    poll();

    // Setup interval
    pollTimerRef.current = window.setInterval(poll, 1500);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [pollingActive, jobs, jobIds]);

  const triggerConfettiCelebration = () => {
    // Elegant double confetti burst
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#3b82f6", "#10b981", "#f59e0b"]
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#3b82f6", "#10b981", "#f59e0b"]
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  const getJobProgressPercentage = (job: UploadStatusResponse) => {
    if (job.status === "success") return 100;
    if (job.total_bytes === 0) return 0;
    return Math.round((job.progress_bytes / job.total_bytes) * 100);
  };

  const jobsList = Object.values(jobs);
  const isFinished = !pollingActive;

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h2 style={{ fontSize: "1.35rem", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "10px" }}>
          {isFinished ? "Upload processing complete" : "Uploading files to Commons..."}
          {!isFinished && <Loader2 size={20} className="animate-spin" color="var(--accent-wikimedia)" />}
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          {isFinished 
            ? "Files have been processed. Review outcomes below." 
            : "Streaming file bytes from Google Photos and publishing directly to Commons stashing APIs."}
        </p>
      </div>

      {/* Upload Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {jobsList.map((job) => {
          const percent = getJobProgressPercentage(job);
          const isQueued = job.status === "queued";
          const isUploading = job.status === "uploading";
          const isSuccess = job.status === "success";
          const isFailed = job.status === "failed";

          return (
            <div
              key={job.job_id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                background: "var(--bg-secondary)",
                padding: "16px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <span style={{ fontWeight: 500, fontSize: "0.95rem", color: "var(--text-primary)", wordBreak: "break-all" }}>
                  {job.filename}
                </span>

                {/* Status Badges */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {isQueued && (
                    <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      <RefreshCw size={14} className="animate-pulse" /> Queued
                    </span>
                  )}
                  {isUploading && (
                    <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: "var(--accent-wikimedia)" }}>
                      <Loader2 size={14} className="animate-spin" /> {percent}% Uploading
                    </span>
                  )}
                  {isSuccess && (
                    <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: "var(--success)" }}>
                      <CheckCircle2 size={14} /> Completed
                    </span>
                  )}
                  {isFailed && (
                    <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: "var(--danger)" }}>
                      <XCircle size={14} /> Failed
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar container */}
              <div
                style={{
                  height: "8px",
                  background: "var(--bg-input)",
                  borderRadius: "4px",
                  overflow: "hidden",
                  position: "relative",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${percent}%`,
                    backgroundColor: isFailed ? "var(--danger)" : (isSuccess ? "var(--success)" : "var(--accent-wikimedia)"),
                    borderRadius: "4px",
                    transition: "width 0.4s ease-out",
                  }}
                />
              </div>

              {/* Action buttons and links */}
              {isSuccess && job.description_url && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                  <a
                    href={job.description_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    View on Commons <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {/* Error logs */}
              {isFailed && job.error && (
                <p style={{ color: "var(--danger)", fontSize: "0.8rem", marginTop: "4px" }}>
                  Error: {job.error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Done Button */}
      {isFinished && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: "16px" }}>
          <button
            onClick={onDone}
            style={{
              padding: "12px 24px",
              backgroundColor: "var(--accent-wikimedia)",
              color: "white",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Sparkles size={16} /> Return to Dashboard
          </button>
        </div>
      )}
    </div>
  );
};

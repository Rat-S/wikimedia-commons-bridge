import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import type { MediaItem } from "../api/client";
import { CategorySearch } from "./CategorySearch";
import { Check, Edit3, Grid, Layers, Sparkles, Globe, FileText, CheckCircle, Info } from "lucide-react";

export interface CuratedMediaItem {
  id: string;
  filename: string;
  mime_type: string;
  creation_time: string;
  base_url: string;
  commons_filename: string;
  description: string;
  date: string;
  license_code: string;
  categories: string[];
  lat?: number;
  lon?: number;
}

interface MetadataEditorProps {
  selectedItems: MediaItem[];
  onUploadSubmit: (items: CuratedMediaItem[]) => void;
  onCancel: () => void;
  wikimediaUsername: string;
}

export const MetadataEditor: React.FC<MetadataEditorProps> = ({
  selectedItems,
  onUploadSubmit,
  onCancel,
  wikimediaUsername
}) => {
  const [curatedItems, setCuratedItems] = useState<CuratedMediaItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  
  // Batch edit helper states
  const [batchLicense, setBatchLicense] = useState("cc-by-sa-4.0");
  const [batchDescription, setBatchDescription] = useState("");
  const [batchCategories, setBatchCategories] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);

  // Initialize curated items array when selectedItems changes
  useEffect(() => {
    const initialized = selectedItems.map((item) => {
      // Clean dates (extract YYYY-MM-DD)
      let cleanedDate = "";
      if (item.creation_time) {
        cleanedDate = item.creation_time.split("T")[0];
      } else {
        cleanedDate = new Date().toISOString().split("T")[0];
      }

      // Propose clean filename: replace spaces/special chars, keep extension
      const itemFilename = item.filename || `photo_${item.id}.jpg`;
      const extIndex = itemFilename.lastIndexOf(".");
      const nameWithoutExt = extIndex !== -1 ? itemFilename.substring(0, extIndex) : itemFilename;
      const ext = extIndex !== -1 ? itemFilename.substring(extIndex) : ".jpg";
      const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, "_") + ext;

      return {
        id: item.id,
        filename: itemFilename,
        mime_type: item.mime_type,
        creation_time: item.creation_time,
        base_url: item.base_url,
        commons_filename: cleanName,
        description: "",
        date: cleanedDate,
        license_code: "cc-by-sa-4.0",
        categories: []
      };
    });
    setCuratedItems(initialized);
    setSelectedIndex(0);
  }, [selectedItems]);

  const activeItem = curatedItems[selectedIndex];

  const updateActiveField = (field: keyof CuratedMediaItem, value: any) => {
    setCuratedItems((prev) => {
      const updated = [...prev];
      updated[selectedIndex] = {
        ...updated[selectedIndex],
        [field]: value
      };
      return updated;
    });
  };

  const copyFieldToAll = (field: keyof CuratedMediaItem) => {
    if (!activeItem) return;
    const value = activeItem[field];
    setCuratedItems(prev => prev.map(item => ({
      ...item,
      [field]: value
    })));
  };

  const copyAllFieldsToAll = () => {
    if (!activeItem) return;
    setCuratedItems(prev => prev.map(item => ({
      ...item,
      description: activeItem.description,
      date: activeItem.date,
      license_code: activeItem.license_code,
      categories: [...activeItem.categories]
    })));
  };

  // Helper validation
  const validateItem = (item: CuratedMediaItem) => {
    if (!item) return false;
    const titleClean = item.commons_filename.trim();
    const hasValidTitle = titleClean.length >= 5 && titleClean.includes(".");
    const hasDescription = item.description.trim().length >= 8;
    const hasLicense = !!item.license_code;
    return hasValidTitle && hasDescription && hasLicense;
  };

  const isBatchValid = curatedItems.every(validateItem);

  // Batch Editor: apply values to all items in the list
  const applyBatchEdits = () => {
    setCuratedItems((prev) =>
      prev.map((item) => ({
        ...item,
        license_code: batchLicense,
        // Append batch description if not already prefixed
        description: batchDescription 
          ? (item.description ? `${batchDescription} - ${item.description}` : batchDescription)
          : item.description,
        // Merge batch categories, preventing duplicates
        categories: Array.from(new Set([...item.categories, ...batchCategories]))
      }))
    );
    setShowBatchModal(false);
  };

  const handleSubmit = () => {
    if (isBatchValid) {
      onUploadSubmit(curatedItems);
    }
  };

  if (curatedItems.length === 0) return null;

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 600, color: "var(--text-primary)" }}>
            Curate Metadata ({curatedItems.length} photos selected)
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Wikimedia Commons requires descriptive titles, english descriptions, and open licensing tags.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => setShowBatchModal(!showBatchModal)}
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Layers size={16} /> Batch Editor
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              backgroundColor: "transparent",
              color: "var(--text-secondary)"
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Batch Edit Modal Panel */}
      {showBatchModal && (
        <div
          className="glass-panel animate-fade-in"
          style={{
            padding: "20px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--accent-wikimedia)",
            display: "flex",
            flexDirection: "column",
            gap: "16px"
          }}
        >
          <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-primary)" }}>
            Apply changes to all {curatedItems.length} images
          </h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>
                Batch Licence
              </label>
              <select value={batchLicense} onChange={(e) => setBatchLicense(e.target.value)}>
                <option value="cc-by-sa-4.0">Creative Commons Attribution-ShareAlike 4.0</option>
                <option value="cc-by-4.0">Creative Commons Attribution 4.0</option>
                <option value="cc0-1.0">Public Domain Dedication (CC0)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>
                Add Description Prefix
              </label>
              <input
                type="text"
                placeholder="Prefix to append (e.g. Scenery in Vellalore)"
                value={batchDescription}
                onChange={(e) => setBatchDescription(e.target.value)}
              />
            </div>

            <div style={{ gridColumn: "span 1" }}>
              <CategorySearch
                selectedCategories={batchCategories}
                onAddCategory={(cat) => setBatchCategories(prev => [...prev, cat])}
                onRemoveCategory={(cat) => setBatchCategories(prev => prev.filter(c => c !== cat))}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
            <button
              onClick={() => setShowBatchModal(false)}
              style={{ padding: "8px 14px", background: "none", color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
            <button
              onClick={applyBatchEdits}
              style={{
                padding: "8px 16px",
                backgroundColor: "var(--accent-wikimedia)",
                color: "white"
              }}
            >
              Apply Batch Edits
            </button>
          </div>
        </div>
      )}

      {/* Main Curation Layout splits: Left (thumbnails), Center (detail preview), Right (Form fields) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "180px 1fr 350px",
          gap: "24px",
          minHeight: "500px"
        }}
        className="curator-grid"
      >
        {/* Left column: Thumbnail list navigation */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            maxHeight: "500px",
            overflowY: "auto",
            paddingRight: "8px"
          }}
        >
          {curatedItems.map((item, idx) => {
            const isValid = validateItem(item);
            const isActive = idx === selectedIndex;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedIndex(idx)}
                style={{
                  display: "flex",
                  padding: "4px",
                  background: isActive ? "var(--bg-input)" : "transparent",
                  border: isActive ? "2px solid var(--accent-wikimedia)" : "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  position: "relative",
                  width: "100%",
                  aspectRatio: "1.4",
                  overflow: "hidden"
                }}
              >
                <img
                  src={api.getProxyUrl(`${item.base_url}=w150-h150-c`)}
                  alt={item.filename}
                  crossOrigin="use-credentials"
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "4px" }}
                />
                {isValid && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: "4px",
                      right: "4px",
                      background: "var(--success)",
                      color: "white",
                      borderRadius: "50%",
                      width: "18px",
                      height: "18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Center column: Active image preview and wikitext metadata panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Active Preview */}
          <div
            className="glass-panel"
            style={{
              flex: 1,
              maxHeight: "350px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              position: "relative",
              background: "black",
              borderRadius: "var(--radius-lg)"
            }}
          >
            <img
              src={api.getProxyUrl(`${activeItem.base_url}=w800`)}
              alt={activeItem.commons_filename}
              crossOrigin="use-credentials"
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            />
          </div>

          {/* Active metadata summary banner */}
          <div style={{ display: "flex", gap: "12px", background: "var(--bg-secondary)", padding: "12px 16px", borderRadius: "var(--radius-md)" }}>
            <FileText size={20} color="var(--accent-wikimedia)" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: "0.85rem", overflow: "hidden" }}>
              <strong style={{ color: "var(--text-primary)", display: "block" }}>Commons Target File Destination:</strong>
              <span style={{ color: "var(--text-secondary)", wordBreak: "break-all" }}>
                File:{activeItem.commons_filename || "Pending name..."}
              </span>
            </div>
          </div>
        </div>

        {/* Right column: Single Item Editor Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "500px", overflowY: "auto", paddingRight: "4px" }}>
          {curatedItems.length > 1 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "4px" }}>
              <button
                type="button"
                onClick={copyAllFieldsToAll}
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--accent-wikimedia)",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-sm)",
                  padding: "6px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <Layers size={14} /> Copy All Fields to All Images
              </button>
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
              File Title (descriptive, with extension)
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={activeItem.commons_filename}
                onChange={(e) => updateActiveField("commons_filename", e.target.value)}
              />
            </div>
            {activeItem.commons_filename.trim().length < 5 && (
              <span style={{ fontSize: "0.75rem", color: "var(--danger)" }}>Title must be at least 5 characters.</span>
            )}
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>
                Description (English, min 8 chars)
              </label>
              {curatedItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => copyFieldToAll("description")}
                  style={{ fontSize: "0.75rem", color: "var(--accent-wikimedia)", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
                >
                  Copy to all
                </button>
              )}
            </div>
            <textarea
              rows={3}
              placeholder="Describe what is depicted in the photo..."
              value={activeItem.description}
              onChange={(e) => updateActiveField("description", e.target.value)}
              style={{ resize: "none" }}
            />
            {activeItem.description.trim().length < 8 && (
              <span style={{ fontSize: "0.75rem", color: "var(--danger)" }}>Description must be at least 8 characters.</span>
            )}
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>
                Creation Date (YYYY-MM-DD)
              </label>
              {curatedItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => copyFieldToAll("date")}
                  style={{ fontSize: "0.75rem", color: "var(--accent-wikimedia)", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
                >
                  Copy to all
                </button>
              )}
            </div>
            <input
              type="date"
              value={activeItem.date}
              onChange={(e) => updateActiveField("date", e.target.value)}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>
                License
              </label>
              {curatedItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => copyFieldToAll("license_code")}
                  style={{ fontSize: "0.75rem", color: "var(--accent-wikimedia)", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
                >
                  Copy to all
                </button>
              )}
            </div>
            <select
              value={activeItem.license_code}
              onChange={(e) => updateActiveField("license_code", e.target.value)}
            >
              <option value="cc-by-sa-4.0">Creative Commons Attribution-ShareAlike 4.0</option>
              <option value="cc-by-4.0">Creative Commons Attribution 4.0</option>
              <option value="cc0-1.0">Public Domain Dedication (CC0)</option>
            </select>
          </div>

          <div>
            <CategorySearch
              selectedCategories={activeItem.categories}
              onAddCategory={(cat) => updateActiveField("categories", [...activeItem.categories, cat])}
              onRemoveCategory={(cat) => updateActiveField("categories", activeItem.categories.filter(c => c !== cat))}
              onCopyToAll={curatedItems.length > 1 ? () => copyFieldToAll("categories") : undefined}
            />
          </div>

          {/* Optional GPS Location preview */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>
            <Globe size={14} />
            <span>Author user context: [[User:{wikimediaUsername}]]</span>
          </div>
        </div>
      </div>

      {/* Footer controls: validation feedback and upload triggers */}
      <div
        style={{
          borderTop: "1px solid var(--border-color)",
          paddingTop: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isBatchValid ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--success)", fontSize: "0.9rem" }}>
              <CheckCircle size={16} /> All items valid and ready to publish.
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--warning)", fontSize: "0.9rem" }}>
              <Info size={16} /> Fill in title and description for all selected images to enable upload.
            </div>
          )}
        </div>

        <button
          disabled={!isBatchValid}
          onClick={handleSubmit}
          style={{
            padding: "14px 28px",
            backgroundColor: isBatchValid ? "var(--accent-wikimedia)" : "var(--bg-input)",
            color: isBatchValid ? "white" : "var(--text-muted)",
            cursor: isBatchValid ? "pointer" : "not-allowed",
            fontWeight: 600,
            fontSize: "1.05rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: isBatchValid ? "0 4px 14px var(--border-glow)" : "none"
          }}
        >
          <Sparkles size={18} />
          Upload {curatedItems.length} photos to Commons
        </button>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, Plus, X } from "lucide-react";

interface CategorySearchProps {
  selectedCategories: string[];
  onAddCategory: (category: string) => void;
  onRemoveCategory: (category: string) => void;
}

export const CategorySearch: React.FC<CategorySearchProps> = ({
  selectedCategories,
  onAddCategory,
  onRemoveCategory,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<number | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  // Debounced Category Fetching
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        const url = `https://commons.wikimedia.org/w/api.php?action=opensearch&format=json&namespace=14&limit=8&origin=*&search=${encodeURIComponent(cleanQuery)}`;
        const response = await fetch(url, {
          headers: {
            "User-Agent": "WikimediaCommonsBridge/1.0 (https://github.com/anu/wikimedia-commons-bridge; mailto:info@covai.org)"
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const categoryResults: string[] = data[1] || [];
          
          // Clean category names by stripping "Category:" namespace prefix
          const cleanedResults = categoryResults.map((cat) => 
            cat.startsWith("Category:") ? cat.substring(9) : cat
          );
          
          setResults(cleanedResults);
          setShowDropdown(cleanedResults.length > 0);
        }
      } catch (err) {
        console.error("Failed to fetch Wikimedia categories:", err);
      } finally {
        setSearching(false);
      }
    }, 300); // 300ms debounce
  }, [query]);

  const handleSelect = (category: string) => {
    if (!selectedCategories.includes(category)) {
      onAddCategory(category);
    }
    setQuery("");
    setShowDropdown(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>
        Add Commons Categories
      </label>

      {/* Input Autocomplete Box */}
      <div style={{ position: "relative" }} ref={dropdownRef}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search categories (e.g. Vellalore, Agriculture)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim().length >= 2 && setShowDropdown(true)}
            style={{ paddingLeft: "36px" }}
          />
          <div style={{ position: "absolute", left: "12px", color: "var(--text-muted)", display: "flex" }}>
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          </div>
        </div>

        {/* Suggestion Dropdown */}
        {showDropdown && results.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-lg)",
              zIndex: 50,
              maxHeight: "220px",
              overflowY: "auto",
            }}
          >
            {results.map((result) => (
              <button
                key={result}
                onClick={() => handleSelect(result)}
                style={{
                  display: "flex",
                  width: "100%",
                  padding: "10px 14px",
                  textAlign: "left",
                  background: "none",
                  color: "var(--text-primary)",
                  fontSize: "0.9rem",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderRadius: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-input)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span>{result}</span>
                <Plus size={14} color="var(--accent-wikimedia)" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Categories Tags */}
      {selectedCategories.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
          {selectedCategories.map((cat) => (
            <span
              key={cat}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-color)",
                padding: "4px 10px",
                borderRadius: "16px",
                fontSize: "0.8rem",
                color: "var(--text-primary)",
              }}
            >
              <span>{cat}</span>
              <button
                onClick={() => onRemoveCategory(cat)}
                style={{
                  background: "none",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  color: "var(--text-muted)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

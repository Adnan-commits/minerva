import axios from "axios";

const BASE_URL = "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Health
export const checkHealth = () => api.get("/health");

// Web Scraping
export const scrapeURL = (url) => api.post("/web/scrape", { url });

// PDF
export const extractPDF = (file_path) => api.post("/pdf/extract", { file_path });
export const extractPDFSummary = (file_path) => api.post("/pdf/summary", { file_path });

// History
export const getHistory = (params = {}) => api.get("/history", { params });

// Research — streaming via native fetch + ReadableStream
// onChunk(text)  : called for each token as it arrives
// onDone(full)   : called once with the complete assembled text
// onError(msg)   : called if the stream fails
export const research = async ({ query, mode, url, file_path }, onChunk, onDone, onError) => {
  const token = localStorage.getItem("minerva_token");

  let response;
  try {
    response = await fetch(`${BASE_URL}/research`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, mode, url, file_path }),
    });
  } catch (err) {
    onError?.("Network error — could not reach the server.");
    return;
  }

  if (!response.ok) {
    try {
      const data = await response.json();
      onError?.(data?.detail?.error || "Research failed.");
    } catch {
      onError?.("Research failed.");
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by double newlines — split and process each
    const frames = buffer.split("\n\n");
    buffer = frames.pop(); // last element may be an incomplete frame — keep in buffer

    for (const frame of frames) {
      if (!frame.startsWith("data: ")) continue;
      const payload = frame.slice(6); // strip "data: " prefix

      if (payload === "[DONE]") {
        // Stream finished — nothing to do here, onDone already called via [FULL]
        continue;
      }

      if (payload.startsWith("[ERROR]")) {
        onError?.(payload.slice(7));
        return;
      }

      if (payload.startsWith("[FULL]")) {
        // Base64-encoded full response for export/chat use
        try {
          const fullText = atob(payload.slice(6));
          onDone?.(fullText);
        } catch {
          // If decode fails, onDone won't fire — Results.jsx handles this gracefully
        }
        continue;
      }

      // Regular token chunk — unescape newlines and forward to UI
      const text = payload.replace(/\\n/g, "\n");
      onChunk?.(text);
    }
  }
};

// Export PDF
export const exportPDF = (report, query) =>
  api.post("/export/pdf", { report, query }, { responseType: "blob" });

// Export Markdown & JSON
export const exportMarkdown = (report, query, mode) =>
  api.post("/export/markdown", { report, query, mode }, { responseType: "blob" });

export const exportJSON = (report, query, mode) =>
  api.post("/export/json", { report, query, mode }, { responseType: "blob" });

// Preview
export const previewJSON = (report, query, mode) =>
  api.post("/preview/json", { report, query, mode });

// Authentication
export const login = (username, password) =>
  api.post("/auth/login", { username, password });

// Stats
export const getStats = () => api.get("/stats");

// Report Chat — follow-up Q&A grounded in an existing report
export const chatWithReport = (report, query, message, history) =>
  api.post("/chat/report", { report, query, message, history });

export default api;
"use client";

import { useState, useCallback, useRef, DragEvent, ChangeEvent } from "react";

interface ImportResult {
  success: boolean;
  memoriesCreated: number;
  memoriesSkipped: number;
  categoriesUsed: number;
  parseResult: {
    format: string;
    totalLines: number;
    parsedMessages: number;
    skippedMessages: number;
  };
  error?: string;
}

type ImportStatus = "idle" | "uploading" | "processing" | "complete" | "error";

export default function ChatImport() {
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    // Validate file
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".txt") && !fileName.endsWith(".text")) {
      setError("Please upload a .txt chat export file.");
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum 10MB.");
      return;
    }
    
    setSelectedFile(file);
    setError(null);
    setResult(null);
    setStatus("idle");
  }, []);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleImport = useCallback(async () => {
    if (!selectedFile) return;

    setStatus("uploading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      setStatus("processing");

      const response = await fetch("/api/import/chat-history", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import failed");
      }

      setResult(data);
      setStatus("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStatus("error");
    }
  }, [selectedFile]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    setStatus("idle");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-cyan-400 bg-cyan-950/30"
            : "border-gray-600 hover:border-gray-500 bg-gray-900/50"
        } ${status === "processing" ? "opacity-50 pointer-events-none" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.text"
          onChange={handleInputChange}
          className="hidden"
          disabled={status === "processing"}
        />
        
        <div className="text-4xl mb-3">📂</div>
        <p className="text-lg font-medium text-gray-200 mb-2">
          Drop your chat export here
        </p>
        <p className="text-sm text-gray-400">
          or click to browse
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Supports WhatsApp and Telegram .txt exports (max 10MB)
        </p>
        
        {selectedFile && (
          <div className="mt-4 p-3 bg-cyan-900/30 rounded-lg inline-block">
            <p className="text-cyan-400 font-medium">
              {selectedFile.name}
            </p>
            <p className="text-xs text-gray-400">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
        )}
      </div>

      {/* Import button */}
      {selectedFile && status === "idle" && (
        <button
          onClick={handleImport}
          className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition font-medium"
        >
          Import Memories
        </button>
      )}

      {/* Processing state */}
      {status === "processing" && (
        <div className="text-center py-6">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-cyan-400 border-t-transparent mb-4"></div>
          <p className="text-cyan-400 font-medium">Processing your chat history...</p>
          <p className="text-sm text-gray-400 mt-2">
            This may take a minute for large files.
          </p>
        </div>
      )}

      {/* Success result */}
      {status === "complete" && result && (
        <div className="bg-gray-800/50 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎉</span>
            <div>
              <p className="text-xl font-bold text-green-400">Import Complete!</p>
              <p className="text-sm text-gray-400">
                Format detected: {result.parseResult.format}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900/50 rounded-lg p-4">
              <p className="text-2xl font-bold text-cyan-400">{result.memoriesCreated}</p>
              <p className="text-sm text-gray-400">Memories Created</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4">
              <p className="text-2xl font-bold text-gray-300">{result.parseResult.parsedMessages}</p>
              <p className="text-sm text-gray-400">Messages Parsed</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4">
              <p className="text-2xl font-bold text-gray-300">{result.categoriesUsed}</p>
              <p className="text-sm text-gray-400">Categories Used</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4">
              <p className="text-2xl font-bold text-gray-500">{result.memoriesSkipped}</p>
              <p className="text-sm text-gray-400">Skipped</p>
            </div>
          </div>
          
          <button
            onClick={handleReset}
            className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
          >
            Import Another File
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400 font-medium">{error}</p>
          {status === "error" && (
            <button
              onClick={handleReset}
              className="mt-3 text-sm text-red-300 hover:text-red-200 underline"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-900/30 rounded-lg p-4 space-y-3">
        <p className="font-medium text-gray-300">How to export your chat:</p>
        
        <div className="space-y-2 text-sm text-gray-400">
          <div className="flex items-start gap-2">
            <span className="text-lg">📱</span>
            <div>
              <p className="text-gray-300 font-medium">WhatsApp</p>
              <p>Open chat → Menu (⋮) → More → Export chat → Without media</p>
            </div>
          </div>
          
          <div className="flex items-start gap-2">
            <span className="text-lg">📱</span>
            <div>
              <p className="text-gray-300 font-medium">Telegram</p>
              <p>Open chat → Menu (⋮) → Export chat history → Format: Text</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

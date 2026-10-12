"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, FileText, Sparkles, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { AnswerKeyData } from "@/types/grading";
import { SAMPLE_AISCC_KEY } from "@/constants/sampleKey";

interface Step1UploadKeyProps {
  onKeyLoaded: (keyData: AnswerKeyData) => void;
}

export const Step1UploadKey: React.FC<Step1UploadKeyProps> = ({ onKeyLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMsg("Please upload a PDF file containing the answer key or shaded template.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/answer-key/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        if (res.status === 404 || res.status === 502 || res.status === 503) {
          throw new Error(
            "Backend grading engine is offline or unreachable on port 8001. Please run 'run_backend.bat' locally (or verify NEXT_PUBLIC_BACKEND_URL on Vercel)."
          );
        }
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed (${res.status})`);
      }

      const keyData: AnswerKeyData = await res.json();
      onKeyLoaded(keyData);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process PDF answer key.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSample = () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // Load preconfigured AISCC key directly
      onKeyLoaded(SAMPLE_AISCC_KEY);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load sample key.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBlank = (totalQuestions: number) => {
    const answers: Record<string, string> = {};
    const section_mapping: Record<string, string> = {};
    const sections =
      totalQuestions === 160
        ? ["General Information", "Logical Reasoning", "Mathematics", "English"]
        : ["Part 1"];

    for (let i = 1; i <= totalQuestions; i++) {
      answers[i.toString()] = "A";
      if (totalQuestions === 160) {
        const secIdx = Math.floor((i - 1) / 40);
        section_mapping[i.toString()] = sections[secIdx] || "General";
      } else {
        section_mapping[i.toString()] = "Part 1";
      }
    }

    onKeyLoaded({
      title: totalQuestions === 160 ? "AISCC Qualifying Exam Key (Manual)" : "Standard Exam Key",
      description: "Manually initialized key. Please verify or edit answers before grading.",
      total_questions: totalQuestions,
      sections,
      answers,
      section_mapping,
      choices_per_question: 4,
      is_verified: false,
    });
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in duration-300">
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 mb-3">
          Step 1 of 5 • Answer Key Setup
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Upload Answer Key PDF
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
          Upload an official answer sheet with pre-shaded answers, a text/tabular answer key PDF, or load the preconfigured AISCC Batch 02 exam key.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 flex items-start gap-3 text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Upload Error</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Main Drag & Drop Box */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[1.01]"
            : "border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
        } bg-white dark:bg-slate-900 shadow-sm`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />

        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              Analyzing PDF Answer Key...
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Extracting vector coordinates, symbols, and question-option mappings
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 border border-blue-100 dark:border-blue-900">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Drag &amp; drop your Answer Key PDF here
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              Supports vector answer sheets with shaded boxes, scanned PDF answer keys, or tabular text PDFs.
            </p>
            <button
              type="button"
              className="mt-5 px-4 py-2 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition shadow-xs"
            >
              Browse PDF File
            </button>
          </div>
        )}
      </div>

      {/* Quick Action: Load Sample Key */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/30 dark:to-slate-900 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              1-Click Demo Ready
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Load Official AISCC Batch 02 Key
            </h4>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Preloads the 160-question official answer key for Aeronautical Information Service Comprehensive Course qualifying exam (160 items, 4 subjects).
            </p>
          </div>
          <button
            onClick={handleLoadSample}
            disabled={isLoading}
            className="mt-4 w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Load Sample AISCC Key (160 Qs)
          </button>
        </div>

        {/* Manual Configuration */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
              <CheckCircle2 className="w-4 h-4" />
              Custom / Manual Template
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Initialize Custom Answer Key
            </h4>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Don&apos;t have an answer-key PDF? Initialize a clean template to manually define correct choices.
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => handleCreateBlank(160)}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              160 Qs (AISCC)
            </button>
            <button
              onClick={() => handleCreateBlank(50)}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              50 Qs Standard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

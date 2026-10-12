"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, RotateCcw, ShieldCheck, Moon, Sun, AlertTriangle, Activity } from "lucide-react";
import { GradingStep } from "@/types/grading";

interface NavbarProps {
  currentStep: GradingStep;
  onResetSession: () => void;
  hasActiveSession: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentStep,
  onResetSession,
  hasActiveSession
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.status === "online") {
            setBackendStatus("online");
            return;
          }
        }
        setBackendStatus("offline");
      } catch (e) {
        setBackendStatus("offline");
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <>
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shadow-blue-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white tracking-tight text-lg">
                  ScanGrade<span className="text-blue-600">OMR</span>
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  AISCC Batch 02
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                AI &amp; OpenCV-Assisted Examination Paper Grading Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Backend Status Badge */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                backendStatus === "online"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                  : backendStatus === "checking"
                  ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200"
                  : "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800"
              }`}
              title={
                backendStatus === "online"
                  ? "FastAPI OpenCV Engine Connected"
                  : "Backend offline. Run 'run_backend.bat' to start the Python server on port 8001."
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  backendStatus === "online"
                    ? "bg-emerald-500 animate-pulse"
                    : backendStatus === "checking"
                    ? "bg-slate-400"
                    : "bg-red-500"
                }`}
              />
              <span>
                {backendStatus === "online"
                  ? "Engine Online"
                  : backendStatus === "checking"
                  ? "Connecting..."
                  : "Engine Offline"}
              </span>
            </div>

            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {hasActiveSession && (
              <button
                onClick={() => setShowConfirmModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset Session</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-500 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Discard Current Session?</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Are you sure you want to start a new session? Any unsaved scan results and answer keys will be cleared. (No data is permanently stored).
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  onResetSession();
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition shadow-sm"
              >
                Yes, Discard &amp; Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

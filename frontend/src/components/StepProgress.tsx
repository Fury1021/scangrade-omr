"use client";

import React from "react";
import { Check, FileText, CheckSquare, Camera, AlertCircle, Award } from "lucide-react";
import { GradingStep } from "@/types/grading";

interface StepProgressProps {
  currentStep: GradingStep;
  onStepClick: (step: GradingStep) => void;
  canNavigateTo: (step: GradingStep) => boolean;
}

const STEPS: { id: GradingStep; label: string; icon: React.ElementType }[] = [
  { id: "upload-key", label: "1. Answer Key", icon: FileText },
  { id: "verify-key", label: "2. Verify Key", icon: CheckSquare },
  { id: "scan-sheet", label: "3. Scan Sheet", icon: Camera },
  { id: "review-detection", label: "4. Review", icon: AlertCircle },
  { id: "results", label: "5. Results", icon: Award },
];

export const StepProgress: React.FC<StepProgressProps> = ({
  currentStep,
  onStepClick,
  canNavigateTo,
}) => {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="w-full bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 py-3 px-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCurrent = step.id === currentStep;
          const isCompleted = index < currentIndex;
          const isClickable = canNavigateTo(step.id);

          return (
            <React.Fragment key={step.id}>
              <button
                disabled={!isClickable}
                onClick={() => onStepClick(step.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isCurrent
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                    : isCompleted
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                    : isClickable
                    ? "text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                    : "text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isCurrent
                      ? "bg-white text-blue-600"
                      : isCompleted
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {isCompleted ? <Check className="w-3 h-3 stroke-[3]" /> : index + 1}
                </span>
                <span className="hidden md:inline">{step.label}</span>
                <span className="md:hidden">{step.label.split(". ")[1]}</span>
              </button>

              {index < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 min-w-3 max-w-8 transition-colors ${
                    index < currentIndex
                      ? "bg-emerald-500"
                      : "bg-slate-200 dark:bg-slate-800"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

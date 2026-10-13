"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, ArrowRight, ArrowLeft, HelpCircle } from "lucide-react";
import { GradingResult, QuestionAnswer } from "@/types/grading";

interface Step4ReviewDetectionProps {
  gradingResult: GradingResult;
  onUpdateResult: (updated: GradingResult) => void;
  onProceed: () => void;
  onBack: () => void;
}

export const Step4ReviewDetection: React.FC<Step4ReviewDetectionProps> = ({
  gradingResult,
  onUpdateResult,
  onProceed,
  onBack,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter questions that need review
  const uncertainQuestions = gradingResult.questions.filter(
    (q) => q.needs_review || q.status === "ambiguous"
  );

  const handleCorrectQuestion = async (qNum: number, chosenAnswer: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/grading/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_result: gradingResult,
          correction: {
            question_number: qNum,
            corrected_answer: chosenAnswer,
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to apply correction.");
      }

      const updated: GradingResult = await res.json();
      onUpdateResult(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 mb-2">
            Step 4 of 5 • Detection &amp; Ambiguity Review
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Review Uncertain Detections
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            Resolve light marks, smudges, or multiple shaded options before calculating the final score.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Rescan Paper
          </button>
          <button
            onClick={onProceed}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition shadow-sm shadow-blue-500/20 flex items-center gap-2"
          >
            Finalize &amp; View Official Score
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Review Status Banner */}
      {uncertainQuestions.length === 0 ? (
        <div className="p-8 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-200">
            No Ambiguous Marks Detected!
          </h3>
          <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 max-w-md mx-auto mt-1 mb-6">
            All 160 question responses were identified with high confidence. You can proceed directly to the official grading results.
          </p>
          <button
            onClick={onProceed}
            className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm shadow-emerald-500/20 inline-flex items-center gap-2"
          >
            Proceed to Scorecard
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-center justify-between text-xs sm:text-sm text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>{uncertainQuestions.length} question(s)</strong> require examiner confirmation due to multiple marks or weak shading.
              </span>
            </div>
            <button
              onClick={onProceed}
              className="text-xs font-bold text-amber-900 dark:text-amber-200 underline hover:no-underline"
            >
              Skip &amp; Keep System Flags
            </button>
          </div>

          {/* List of uncertain questions */}
          <div className="space-y-3">
            {uncertainQuestions.map((q) => {
              const localNum = q.local_question_number ?? (((q.question_number - 1) % 40) + 1);
              return (
              <div
                key={q.question_number}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800/60 shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-10 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-extrabold text-xs flex items-center justify-center">
                      #{localNum}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {q.section} • Item #{localNum} <span className="text-xs font-normal text-slate-400">(Q{q.question_number})</span>
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Correct Answer: <strong className="text-slate-700 dark:text-slate-200">{q.correct_answer}</strong> • Detected:{" "}
                        <strong className="text-amber-600 dark:text-amber-400">{q.student_answer || "Unclear"}</strong>
                      </p>
                    </div>
                  </div>

                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-semibold self-start sm:self-auto">
                    Multiple / Weak Mark
                  </span>
                </div>

                {/* Shading fill ratios visual breakdown */}
                <div className="mb-4 grid grid-cols-4 gap-2 text-center text-xs">
                  {q.choices.map((c) => (
                    <div
                      key={c.id}
                      className={`p-2 rounded-xl border ${
                        c.is_marked
                          ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <div className="font-bold text-sm">{c.id}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Fill: {Math.round(c.fill_ratio * 100)}%
                      </div>
                    </div>
                  ))}
                </div>

                {/* Examiner Manual Override Choices */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500 font-medium mr-1">
                    Select verified mark:
                  </span>
                  {["A", "B", "C", "D"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleCorrectQuestion(q.question_number, opt)}
                      disabled={isSubmitting}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        q.student_answer === opt
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      Option {opt}
                    </button>
                  ))}
                  <button
                    onClick={() => handleCorrectQuestion(q.question_number, "BLANK")}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    Confirm Blank / Void
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
};

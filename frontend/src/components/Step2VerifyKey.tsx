"use client";

import React, { useState } from "react";
import { Check, AlertTriangle, ArrowRight, ArrowLeft, Filter, CheckCircle2 } from "lucide-react";
import { AnswerKeyData } from "@/types/grading";

interface Step2VerifyKeyProps {
  answerKey: AnswerKeyData;
  onUpdateKey: (updated: AnswerKeyData) => void;
  onProceed: () => void;
  onBack: () => void;
}

export const Step2VerifyKey: React.FC<Step2VerifyKeyProps> = ({
  answerKey,
  onUpdateKey,
  onProceed,
  onBack,
}) => {
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const choices = ["A", "B", "C", "D"];

  const handleSetAnswer = (qNum: number, choice: string) => {
    const qStr = qNum.toString();
    const current = answerKey.answers[qStr];
    const newAnswer = current === choice ? "BLANK" : choice;

    const updatedAnswers = {
      ...answerKey.answers,
      [qStr]: newAnswer,
    };

    onUpdateKey({
      ...answerKey,
      answers: updatedAnswers,
    });
  };

  // Filter questions based on selected section and search
  const totalQuestions = answerKey.total_questions;
  const questionsList = Array.from({ length: totalQuestions }, (_, i) => i + 1);

  const filteredQuestions = questionsList.filter((qNum) => {
    const qStr = qNum.toString();
    const sec = answerKey.section_mapping[qStr] || "General";
    const matchesSec = selectedSection === "ALL" || sec === selectedSection;
    const matchesSearch = searchQuery === "" || qStr.includes(searchQuery);
    return matchesSec && matchesSearch;
  });

  // Calculate completeness
  const answeredCount = Object.values(answerKey.answers).filter(
    (a) => a && a !== "BLANK"
  ).length;
  const blankCount = totalQuestions - answeredCount;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 mb-2">
            Step 2 of 5 • Verification &amp; Calibration
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Verify Extracted Answer Key
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            Review the extracted key below. Click any option bubble to adjust or correct prior to grading.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={onProceed}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition shadow-sm shadow-blue-500/20 flex items-center gap-2"
          >
            Confirm Key &amp; Proceed to Scan
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Key Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Exam Document</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {answerKey.title}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Questions</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {totalQuestions}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Configured Key Items</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {answeredCount} / {totalQuestions}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Blank / Unassigned</p>
          <p className={`text-lg font-bold ${blankCount > 0 ? "text-amber-500" : "text-slate-700 dark:text-slate-300"}`}>
            {blankCount}
          </p>
        </div>
      </div>

      {blankCount > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-xs sm:text-sm">
            <p className="font-semibold">Notice: Some questions are currently unshaded (e.g. Q39)</p>
            <p className="mt-0.5">
              In the sample AISCC examination key, Question 39 was left blank on the original key sheet. You can click an option below to assign an answer, or leave it blank if Q39 was voided.
            </p>
          </div>
        </div>
      )}

      {/* Filters & Section Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 mb-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Section Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setSelectedSection("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedSection === "ALL"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              All Sections ({totalQuestions})
            </button>
            {answerKey.sections.map((sec) => (
              <button
                key={sec}
                onClick={() => setSelectedSection(sec)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  selectedSection === sec
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {sec}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="w-full md:w-48">
            <input
              type="text"
              placeholder="Search Q# (e.g. 39)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Questions Matrix Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredQuestions.map((qNum) => {
            const qStr = qNum.toString();
            const currentAns = answerKey.answers[qStr] || "BLANK";
            const sec = answerKey.section_mapping[qStr] || "General";
            const isBlank = currentAns === "BLANK";

            return (
              <div
                key={qNum}
                className={`p-3 rounded-xl border transition ${
                  isBlank
                    ? "border-amber-300 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-blue-300"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    Q{qNum}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[100px]">
                    {sec}
                  </span>
                </div>

                {/* Option Buttons */}
                <div className="flex items-center gap-1.5 justify-between">
                  {choices.map((opt) => {
                    const isSelected = currentAns === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleSetAnswer(qNum, opt)}
                        className={`flex-1 h-8 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                          isSelected
                            ? "bg-blue-600 text-white shadow-xs scale-105"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => handleSetAnswer(qNum, "BLANK")}
                    title="Mark as Void / Blank"
                    className={`px-1.5 h-8 rounded-lg text-[10px] font-semibold transition ${
                      isBlank
                        ? "bg-amber-600 text-white"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    Void
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

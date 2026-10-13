"use client";

import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import {
  Download,
  FileSpreadsheet,
  Printer,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  HelpCircle,
  AlertTriangle,
  RotateCcw,
  PlusCircle,
  Search,
  ExternalLink,
  ChevronDown,
  Layers,
  Award,
  Sparkles
} from "lucide-react";
import { GradingResult, QuestionAnswer } from "@/types/grading";

interface Step5ResultsProps {
  result: GradingResult;
  onUpdateResult: (updated: GradingResult) => void;
  onScanAnother: () => void;
  onNewSession: () => void;
}

export const Step5Results: React.FC<Step5ResultsProps> = ({
  result,
  onUpdateResult,
  onScanAnother,
  onNewSession,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterSection, setFilterSection] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAnnotatedOverlay, setShowAnnotatedOverlay] = useState(true);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionAnswer | null>(null);

  // Trigger celebration confetti on high score (> 75%)
  useEffect(() => {
    if (result.percentage >= 75) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // ignore in non-browser env
      }
    }
  }, [result.percentage]);

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ScanGrade_Report_${result.student_name.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert("Failed to download PDF report");
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExportingCSV(true);
    try {
      const res = await fetch("/api/export/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (!res.ok) throw new Error("CSV generation failed");
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ScanGrade_Results_${result.session_id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert("Failed to export CSV");
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleDownloadAnnotatedImage = () => {
    if (!result.annotated_image_url) return;
    const a = document.createElement("a");
    a.href = result.annotated_image_url;
    a.download = `Annotated_Sheet_${result.student_name.replace(/\s+/g, "_")}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleInlineCorrection = async (qNum: number, newAnswer: string) => {
    try {
      const res = await fetch("/api/grading/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_result: result,
          correction: {
            question_number: qNum,
            corrected_answer: newAnswer,
          },
        }),
      });
      if (res.ok) {
        const updated: GradingResult = await res.json();
        onUpdateResult(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter questions list
  const filteredQuestions = result.questions.filter((q) => {
    const localNum = q.local_question_number ?? (((q.question_number - 1) % 40) + 1);
    const matchesStatus = filterStatus === "ALL" || q.status === filterStatus;
    const matchesSection = filterSection === "ALL" || q.section === filterSection;
    const matchesSearch =
      searchQuery === "" ||
      q.question_number.toString() === searchQuery ||
      localNum.toString() === searchQuery ||
      (q.section && q.section.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSection && matchesSearch;
  });

  const isPassed = result.percentage >= 70.0;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 animate-in fade-in duration-300">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 print:hidden">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 mb-2">
            Step 5 of 5 • Official Grading Report
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Examination Scorecard
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            Candidate: <strong className="text-slate-900 dark:text-white">{result.student_name}</strong>
            {result.control_number && ` • Control No: ${result.control_number}`} • Processed in {result.processing_time_ms}ms
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button
            onClick={handleExportCSV}
            disabled={isExportingCSV}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition flex items-center gap-1.5 shadow-sm shadow-blue-500/20"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF Report
          </button>
        </div>
      </div>

      {/* Hero Score Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl mb-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Main Score & Percentage */}
          <div className="md:col-span-1 border-b md:border-b-0 md:border-r border-slate-700/60 pb-6 md:pb-0 md:pr-6 flex flex-col items-center md:items-start text-center md:text-left">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">
              Total Score
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl sm:text-6xl font-black text-white tracking-tight">
                {result.total_score}
              </span>
              <span className="text-xl sm:text-2xl text-slate-400 font-semibold">
                / {result.max_score}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-2xl font-bold text-blue-400">
                {result.percentage}%
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isPassed
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-red-500/20 text-red-300 border border-red-500/30"
                }`}
              >
                {isPassed ? "Qualified / Passed" : "Needs Retest"}
              </span>
            </div>
          </div>

          {/* Metric Badges */}
          <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs flex flex-col items-center justify-center text-center">
              <CheckCircle className="w-5 h-5 text-emerald-400 mb-1" />
              <span className="text-2xl font-black text-white">{result.correct_count}</span>
              <span className="text-[11px] text-slate-300 uppercase font-semibold">Correct</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs flex flex-col items-center justify-center text-center">
              <XCircle className="w-5 h-5 text-red-400 mb-1" />
              <span className="text-2xl font-black text-white">{result.incorrect_count}</span>
              <span className="text-[11px] text-slate-300 uppercase font-semibold">Incorrect</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs flex flex-col items-center justify-center text-center">
              <HelpCircle className="w-5 h-5 text-slate-400 mb-1" />
              <span className="text-2xl font-black text-white">{result.unanswered_count}</span>
              <span className="text-[11px] text-slate-300 uppercase font-semibold">Unanswered</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs flex flex-col items-center justify-center text-center">
              <AlertTriangle className="w-5 h-5 text-amber-400 mb-1" />
              <span className="text-2xl font-black text-white">{result.ambiguous_count}</span>
              <span className="text-[11px] text-slate-300 uppercase font-semibold">Ambiguous</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section Breakdown Grid */}
      {result.sections.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 mb-6 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Subject / Section Breakdown
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {result.sections.map((sec) => (
              <div
                key={sec.section_name}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  <span className="truncate max-w-[130px]">{sec.section_name}</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {sec.score} / {sec.max_score}
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      sec.percentage >= 75
                        ? "bg-emerald-500"
                        : sec.percentage >= 50
                        ? "bg-blue-500"
                        : "bg-amber-500"
                    }`}
                    style={{ width: `${sec.percentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{sec.percentage}% rating</span>
                  <span>{sec.correct_count} correct</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scanned Paper Visual Inspector */}
      {result.annotated_image_url && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 mb-6 shadow-xs print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Scanned Paper Visual Overlay (OpenCV)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Green boxes = Correct • Red boxes = Incorrect • Dotted green = Correct answer key
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAnnotatedOverlay(!showAnnotatedOverlay)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                {showAnnotatedOverlay ? "Show Clean Paper" : "Show Overlay Boxes"}
              </button>
              <button
                onClick={handleDownloadAnnotatedImage}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 hover:bg-blue-100 transition"
              >
                Download Paper Image
              </button>
            </div>
          </div>

          <div className="relative bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center p-3 border border-slate-800 max-h-[550px] overflow-y-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                showAnnotatedOverlay
                  ? result.annotated_image_url
                  : result.warped_image_url || result.annotated_image_url
              }
              alt="Annotated Exam Sheet"
              className="max-h-[500px] w-auto object-contain rounded"
            />
          </div>
        </div>
      )}

      {/* Question by Question Detailed Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Item-by-Item Grading Breakdown ({filteredQuestions.length})
            </h3>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
                {[
                  { id: "ALL", label: "All" },
                  { id: "correct", label: "Correct" },
                  { id: "incorrect", label: "Incorrect" },
                  { id: "unanswered", label: "Blank" },
                  { id: "ambiguous", label: "Review" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterStatus(tab.id)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                      filterStatus === tab.id
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <input
                type="text"
                placeholder="Search Item # or Q#..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Section Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-[11px] font-semibold text-slate-400 mr-1 shrink-0">Subject:</span>
            <button
              onClick={() => setFilterSection("ALL")}
              className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition ${
                filterSection === "ALL"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              All 4 Columns (160)
            </button>
            {result.sections.map((s) => (
              <button
                key={s.section_name}
                onClick={() => setFilterSection(s.section_name)}
                className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition ${
                  filterSection === s.section_name
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                {s.section_name} (1–40)
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Item # (1–40)</th>
                <th className="py-2.5 px-3">Section</th>
                <th className="py-2.5 px-3 text-center">Answer Key</th>
                <th className="py-2.5 px-3 text-center">Student Answer</th>
                <th className="py-2.5 px-3 text-center">Result</th>
                <th className="py-2.5 px-3 text-center">Score</th>
                <th className="py-2.5 px-3 text-center">Confidence</th>
                <th className="py-2.5 px-3 text-right">Quick Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredQuestions.map((q) => {
                const localNum = q.local_question_number ?? (((q.question_number - 1) % 40) + 1);
                const isCorrect = q.status === "correct";
                const isIncorrect = q.status === "incorrect";
                const isUnanswered = q.status === "unanswered";
                const isAmbiguous = q.status === "ambiguous";

                return (
                  <tr
                    key={q.question_number}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          Item #{localNum}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          (Q{q.question_number})
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                      {q.section}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                        {q.correct_answer}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded font-extrabold ${
                          isCorrect
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                            : isIncorrect
                            ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
                            : isAmbiguous
                            ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        }`}
                      >
                        {q.student_answer || "BLANK"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                          isCorrect
                            ? "text-emerald-700 dark:text-emerald-400"
                            : isIncorrect
                            ? "text-red-700 dark:text-red-400"
                            : isAmbiguous
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-slate-500"
                        }`}
                      >
                        {isCorrect && <CheckCircle className="w-3.5 h-3.5" />}
                        {isIncorrect && <XCircle className="w-3.5 h-3.5" />}
                        {isAmbiguous && <AlertTriangle className="w-3.5 h-3.5" />}
                        {isUnanswered && <HelpCircle className="w-3.5 h-3.5" />}
                        {q.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white">
                      {q.points_awarded} pt
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-500 dark:text-slate-400">
                      {Math.round(q.confidence * 100)}%
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {/* 1-Click inline correction buttons */}
                      <div className="flex items-center justify-end gap-1">
                        {["A", "B", "C", "D"].map((opt) => (
                          <button
                            key={opt}
                            onClick={() => handleInlineCorrection(q.question_number, opt)}
                            className={`w-6 h-6 rounded text-[10px] font-bold transition ${
                              q.student_answer === opt
                                ? "bg-blue-600 text-white shadow-xs"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Session Action Buttons */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
        <button
          onClick={onNewSession}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Start New Examination Session
        </button>

        <button
          onClick={onScanAnother}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition shadow-md shadow-blue-500/25 flex items-center justify-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Grade Another Candidate Sheet (Keep Key)
        </button>
      </div>
    </div>
  );
};

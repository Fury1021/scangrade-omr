"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { StepProgress } from "@/components/StepProgress";
import { Step1UploadKey } from "@/components/Step1UploadKey";
import { Step2VerifyKey } from "@/components/Step2VerifyKey";
import { Step3ScanSheet } from "@/components/Step3ScanSheet";
import { Step4ReviewDetection } from "@/components/Step4ReviewDetection";
import { Step5Results } from "@/components/Step5Results";
import { AnswerKeyData, GradingResult, GradingStep } from "@/types/grading";

export default function Home() {
  const [currentStep, setCurrentStep] = useState<GradingStep>("upload-key");
  const [answerKey, setAnswerKey] = useState<AnswerKeyData | null>(null);
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);

  const canNavigateTo = (step: GradingStep): boolean => {
    switch (step) {
      case "upload-key":
        return true;
      case "verify-key":
        return !!answerKey;
      case "scan-sheet":
        return !!answerKey && answerKey.is_verified;
      case "review-detection":
        return !!gradingResult;
      case "results":
        return !!gradingResult;
      default:
        return false;
    }
  };

  const handleKeyLoaded = (keyData: AnswerKeyData) => {
    setAnswerKey(keyData);
    setCurrentStep("verify-key");
  };

  const handleKeyVerified = () => {
    if (answerKey) {
      setAnswerKey({ ...answerKey, is_verified: true });
    }
    setCurrentStep("scan-sheet");
  };

  const handleGraded = (result: GradingResult) => {
    setGradingResult(result);
    // If there are uncertain answers or multiple marks, go to Review step; otherwise, go directly to Results!
    if (result.needs_review_count > 0 || result.ambiguous_count > 0) {
      setCurrentStep("review-detection");
    } else {
      setCurrentStep("results");
    }
  };

  const handleResetSession = () => {
    setAnswerKey(null);
    setGradingResult(null);
    setCurrentStep("upload-key");
  };

  const handleScanAnother = () => {
    setGradingResult(null);
    setCurrentStep("scan-sheet");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar
        currentStep={currentStep}
        onResetSession={handleResetSession}
        hasActiveSession={!!answerKey || !!gradingResult}
      />

      <StepProgress
        currentStep={currentStep}
        onStepClick={(step) => setCurrentStep(step)}
        canNavigateTo={canNavigateTo}
      />

      <main className="flex-1 pb-16">
        {currentStep === "upload-key" && (
          <Step1UploadKey onKeyLoaded={handleKeyLoaded} />
        )}

        {currentStep === "verify-key" && answerKey && (
          <Step2VerifyKey
            answerKey={answerKey}
            onUpdateKey={setAnswerKey}
            onProceed={handleKeyVerified}
            onBack={() => setCurrentStep("upload-key")}
          />
        )}

        {currentStep === "scan-sheet" && answerKey && (
          <Step3ScanSheet
            answerKey={answerKey}
            onGraded={handleGraded}
            onBack={() => setCurrentStep("verify-key")}
          />
        )}

        {currentStep === "review-detection" && gradingResult && (
          <Step4ReviewDetection
            gradingResult={gradingResult}
            onUpdateResult={setGradingResult}
            onProceed={() => setCurrentStep("results")}
            onBack={() => setCurrentStep("scan-sheet")}
          />
        )}

        {currentStep === "results" && gradingResult && (
          <Step5Results
            result={gradingResult}
            onUpdateResult={setGradingResult}
            onScanAnother={handleScanAnother}
            onNewSession={handleResetSession}
          />
        )}
      </main>

      <footer className="py-6 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400 print:hidden">
        <p>
          ScanGrade OMR — AI-Assisted Optical Mark Recognition for CAAP AISCC Exams
        </p>
        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-600">
          In-memory grading engine • Deterministic OpenCV calibration • Zero permanent database storage
        </p>
      </footer>
    </div>
  );
}

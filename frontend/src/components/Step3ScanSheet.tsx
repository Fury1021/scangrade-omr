"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Camera,
  UploadCloud,
  RotateCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowLeft,
  VideoOff,
  SwitchCamera
} from "lucide-react";
import { AnswerKeyData, GradingResult, GradingRules } from "@/types/grading";

interface Step3ScanSheetProps {
  answerKey: AnswerKeyData;
  onGraded: (result: GradingResult) => void;
  onBack: () => void;
}

export const Step3ScanSheet: React.FC<Step3ScanSheetProps> = ({
  answerKey,
  onGraded,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<"camera" | "upload">("upload");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  const [autoAlign, setAutoAlign] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Candidate Metadata
  const [studentName, setStudentName] = useState<string>("Candidate #01");
  const [controlNumber, setControlNumber] = useState<string>("AISCC-2026-089");

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Advanced Rules
  const [showAdvancedRules, setShowAdvancedRules] = useState<boolean>(false);
  const [rules, setRules] = useState<GradingRules>({
    points_per_correct: 1.0,
    points_per_incorrect: 0.0,
    points_per_unanswered: 0.0,
    points_per_ambiguous: 0.0,
    allow_multiple_answers: false,
    fill_threshold: 0.30,
    uncertain_lower_threshold: 0.16,
    ambiguity_margin: 0.12,
  });

  // Start Camera
  const startCamera = async () => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg("Camera access denied or unavailable. Please use file upload instead.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (activeTab === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab, cameraFacing]);

  const snapPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedImage(dataUrl);

    // Convert data URL to Blob file
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "camera_snapshot.jpg", { type: "image/jpeg" });
        setImageFile(file);
      }
    }, "image/jpeg", 0.92);

    stopCamera();
  };

  const handleFileUpload = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setCapturedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    setErrorMsg(null);
  };

  const handleLoadSamplePaper = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/sample/student-sheet");
      if (!res.ok) {
        throw new Error("Could not load sample student paper.");
      }
      const blob = await res.blob();
      const file = new File([blob], "sample_answer_sheet.png", { type: "image/png" });
      handleFileUpload(file);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load sample paper.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleProcessGrading = async () => {
    if (!imageFile) {
      setErrorMsg("Please capture or upload an answer sheet before grading.");
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", imageFile);
      formData.append("answer_key_json", JSON.stringify(answerKey));
      formData.append("rules_json", JSON.stringify(rules));
      formData.append("auto_align", autoAlign.toString());
      formData.append("rotation", rotation.toString());
      formData.append("student_name", studentName);
      formData.append("control_number", controlNumber);

      const res = await fetch("/api/scan/grade", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Grading failed (${res.status})`);
      }

      const gradingResult: GradingResult = await res.json();
      onGraded(gradingResult);
    } catch (err: any) {
      setErrorMsg(err.message || "OMR grading failed. Please verify paper alignment.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 mb-2">
            Step 3 of 5 • Paper Capture &amp; Scanning
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Scan Student Answer Sheet
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            Capture with live camera or upload an image/scanned PDF. OpenCV will deskew, align bubbles, and grade marks.
          </p>
        </div>

        <button
          onClick={onBack}
          className="self-start md:self-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Key
        </button>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 flex items-start gap-3 text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Scanning Notice</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Main Grid: Scan Area + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Capture / Preview Area */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col">
          {/* Capture Mode Tabs */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4 w-fit">
            <button
              onClick={() => {
                setActiveTab("upload");
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "upload"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5 inline mr-1.5" />
              Upload Image / PDF
            </button>
            <button
              onClick={() => {
                setActiveTab("camera");
                setCapturedImage(null);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "camera"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <Camera className="w-3.5 h-3.5 inline mr-1.5" />
              Live Camera
            </button>
          </div>

          {/* Viewport Area */}
          <div className="relative flex-1 min-h-[360px] bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
            {activeTab === "camera" && !capturedImage ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
                {/* Visual Alignment Guide Frame */}
                <div className="absolute inset-8 sm:inset-12 border-2 border-dashed border-blue-400/80 rounded-xl pointer-events-none flex flex-col justify-between p-4">
                  <span className="text-[11px] font-medium text-blue-300 bg-blue-950/70 px-2 py-0.5 rounded w-fit">
                    Align sheet boundaries inside frame
                  </span>
                  <div className="w-full flex justify-center">
                    <span className="text-[11px] text-white/80 bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs">
                      Ensure good lighting &amp; clear shaded boxes
                    </span>
                  </div>
                </div>

                {/* Camera Buttons Floating */}
                <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-3">
                  <button
                    onClick={() =>
                      setCameraFacing((prev) =>
                        prev === "environment" ? "user" : "environment"
                      )
                    }
                    className="p-3 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 transition backdrop-blur-sm"
                    title="Switch Camera"
                  >
                    <SwitchCamera className="w-5 h-5" />
                  </button>
                  <button
                    onClick={snapPhoto}
                    className="px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/30 active:scale-95 transition flex items-center gap-2"
                  >
                    <Camera className="w-5 h-5" />
                    Snap Answer Sheet
                  </button>
                </div>
              </div>
            ) : capturedImage ? (
              <div className="relative w-full h-full flex items-center justify-center p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capturedImage}
                  alt="Scanned Sheet Preview"
                  style={{ transform: `rotate(${rotation}deg)` }}
                  className="max-h-[460px] w-auto object-contain transition-transform duration-200 rounded"
                />
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    onClick={handleRotate}
                    className="p-2 rounded-lg bg-black/70 text-white hover:bg-black transition backdrop-blur-xs text-xs font-semibold flex items-center gap-1.5"
                    title="Rotate 90 degrees"
                  >
                    <RotateCw className="w-4 h-4" />
                    Rotate ({rotation}°)
                  </button>
                  <button
                    onClick={() => {
                      setCapturedImage(null);
                      setImageFile(null);
                      if (activeTab === "camera") startCamera();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-black/70 text-white hover:bg-red-600 transition backdrop-blur-xs text-xs font-semibold"
                  >
                    Clear / Retake
                  </button>
                </div>
              </div>
            ) : (
              /* Upload Dropzone */
              <label className="flex flex-col items-center justify-center p-8 text-center cursor-pointer w-full h-full">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-14 h-14 rounded-2xl bg-slate-800 text-blue-400 flex items-center justify-center mb-3">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <p className="text-sm font-semibold text-white">
                  Drop paper photo or scanned PDF here
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  PNG, JPG, WEBP, or single-page PDF. 200+ DPI recommended for highest accuracy.
                </p>
                <span className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition">
                  Browse Device Files
                </span>
              </label>
            )}
          </div>

          {/* Quick Demo Test Button */}
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              No paper or webcam right now?
            </span>
            <button
              onClick={handleLoadSamplePaper}
              disabled={isProcessing}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Load Sample AISCC Paper Sheet
            </button>
          </div>
        </div>

        {/* Right Column: Candidate Info & OMR Settings */}
        <div className="flex flex-col gap-4">
          {/* Candidate Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              Candidate Information
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Candidate / Examinee Name
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Control / Examinee Number
                </label>
                <input
                  type="text"
                  value={controlNumber}
                  onChange={(e) => setControlNumber(e.target.value)}
                  placeholder="e.g. AISCC-02-045"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* OMR Alignment Controls */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center justify-between">
              <span>OMR Scanner Settings</span>
              <button
                type="button"
                onClick={() => setShowAdvancedRules(!showAdvancedRules)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-normal"
              >
                <Sliders className="w-3.5 h-3.5" />
                {showAdvancedRules ? "Hide Config" : "Grading Rules"}
              </button>
            </h3>

            <div className="space-y-3">
              <label className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <span>Auto-Perspective Deskew</span>
                <input
                  type="checkbox"
                  checked={autoAlign}
                  onChange={(e) => setAutoAlign(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </label>

              {showAdvancedRules && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
                  <div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                      <span>Shading Fill Threshold</span>
                      <span className="font-semibold">{Math.round(rules.fill_threshold * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.15"
                      max="0.50"
                      step="0.05"
                      value={rules.fill_threshold}
                      onChange={(e) =>
                        setRules({ ...rules, fill_threshold: parseFloat(e.target.value) })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                      <span>Points per Correct</span>
                      <span className="font-semibold">{rules.points_per_correct} pt</span>
                    </div>
                    <input
                      type="number"
                      step="0.5"
                      value={rules.points_per_correct}
                      onChange={(e) =>
                        setRules({ ...rules, points_per_correct: parseFloat(e.target.value) || 1.0 })
                      }
                      className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Grade Sheet Action Button */}
          <button
            onClick={handleProcessGrading}
            disabled={isProcessing || !imageFile}
            className={`w-full py-4 rounded-2xl font-bold text-sm transition shadow-md flex items-center justify-center gap-2 ${
              isProcessing || !imageFile
                ? "bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.99] shadow-blue-500/25"
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Scanning &amp; Grading Answer Bubbles...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Scan &amp; Calculate Score
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

"use client";

import React from "react";

interface ScanGuideGridProps {
  mode?: "exam-4col" | "rule-of-thirds";
  opacity?: number;
  showCornerTargets?: boolean;
  showLabels?: boolean;
}

export const ScanGuideGrid: React.FC<ScanGuideGridProps> = ({
  mode = "exam-4col",
  opacity = 0.88,
  showCornerTargets = true,
  showLabels = true,
}) => {
  return (
    <div
      className="absolute inset-3 sm:inset-6 pointer-events-none z-10 flex flex-col justify-between transition-opacity duration-200 select-none"
      style={{ opacity }}
    >
      {/* Corner Bracket Targets */}
      {showCornerTargets && (
        <>
          {/* Top-Left */}
          <div className="absolute -top-1 -left-1 w-6 sm:w-8 h-6 sm:h-8 border-t-3 border-l-3 border-cyan-400 rounded-tl-lg shadow-sm" />
          {/* Top-Right */}
          <div className="absolute -top-1 -right-1 w-6 sm:w-8 h-6 sm:h-8 border-t-3 border-r-3 border-cyan-400 rounded-tr-lg shadow-sm" />
          {/* Bottom-Left */}
          <div className="absolute -bottom-1 -left-1 w-6 sm:w-8 h-6 sm:h-8 border-b-3 border-l-3 border-cyan-400 rounded-bl-lg shadow-sm" />
          {/* Bottom-Right */}
          <div className="absolute -bottom-1 -right-1 w-6 sm:w-8 h-6 sm:h-8 border-b-3 border-r-3 border-cyan-400 rounded-br-lg shadow-sm" />
        </>
      )}

      {/* Grid Content */}
      {mode === "exam-4col" ? (
        <div className="w-full h-full flex flex-col justify-between border border-cyan-400/35 rounded-xl p-2 sm:p-3 bg-cyan-950/10 backdrop-blur-[1px]">
          {/* Top Subject Column Guide Headers */}
          {showLabels && (
            <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center pb-2 border-b border-cyan-400/30">
              <div className="bg-cyan-950/80 backdrop-blur-xs text-cyan-300 border border-cyan-500/40 rounded px-1 py-0.5 text-[9px] sm:text-[10px] font-bold truncate">
                1. General Info
              </div>
              <div className="bg-cyan-950/80 backdrop-blur-xs text-cyan-300 border border-cyan-500/40 rounded px-1 py-0.5 text-[9px] sm:text-[10px] font-bold truncate">
                2. Logical Info
              </div>
              <div className="bg-cyan-950/80 backdrop-blur-xs text-cyan-300 border border-cyan-500/40 rounded px-1 py-0.5 text-[9px] sm:text-[10px] font-bold truncate">
                3. Mathematics
              </div>
              <div className="bg-cyan-950/80 backdrop-blur-xs text-cyan-300 border border-cyan-500/40 rounded px-1 py-0.5 text-[9px] sm:text-[10px] font-bold truncate">
                4. English
              </div>
            </div>
          )}

          {/* 4 Column Vertical Lanes with Item Row Guides */}
          <div className="relative flex-1 grid grid-cols-4 divide-x divide-dashed divide-cyan-400/40 my-1">
            {/* Lane 1: General Info */}
            <div className="flex flex-col justify-between py-1 text-cyan-300/70 text-[8px] sm:text-[9px] pl-1 font-mono">
              <span className="font-semibold">Item #1</span>
              <span>#10</span>
              <span>#20</span>
              <span>#30</span>
              <span className="font-semibold">Item #40</span>
            </div>

            {/* Lane 2: Logical Info */}
            <div className="flex flex-col justify-between py-1 text-cyan-300/70 text-[8px] sm:text-[9px] pl-1 font-mono">
              <span className="font-semibold">Item #1</span>
              <span>#10</span>
              <span>#20</span>
              <span>#30</span>
              <span className="font-semibold">Item #40</span>
            </div>

            {/* Lane 3: Mathematics */}
            <div className="flex flex-col justify-between py-1 text-cyan-300/70 text-[8px] sm:text-[9px] pl-1 font-mono">
              <span className="font-semibold">Item #1</span>
              <span>#10</span>
              <span>#20</span>
              <span>#30</span>
              <span className="font-semibold">Item #40</span>
            </div>

            {/* Lane 4: English */}
            <div className="flex flex-col justify-between py-1 text-cyan-300/70 text-[8px] sm:text-[9px] pl-1 font-mono">
              <span className="font-semibold">Item #1</span>
              <span>#10</span>
              <span>#20</span>
              <span>#30</span>
              <span className="font-semibold">Item #40</span>
            </div>

            {/* Horizontal Guide Lines */}
            <div className="absolute inset-x-0 top-1/4 border-b border-cyan-400/25 pointer-events-none" />
            <div className="absolute inset-x-0 top-2/4 border-b border-cyan-400/35 pointer-events-none" />
            <div className="absolute inset-x-0 top-3/4 border-b border-cyan-400/25 pointer-events-none" />

            {/* Center Alignment Reticle */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-8 h-8 border border-cyan-400/60 rounded-full flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
              </div>
            </div>
          </div>

          {/* Bottom Guidance Bar */}
          <div className="pt-1.5 border-t border-cyan-400/30 flex items-center justify-between text-[10px] text-cyan-200">
            <span className="hidden sm:inline bg-black/60 px-2.5 py-0.5 rounded backdrop-blur-xs">
              Keep camera parallel &amp; ensure good lighting
            </span>
            <span className="bg-cyan-950/80 text-cyan-300 font-semibold px-2.5 py-0.5 rounded border border-cyan-500/30 mx-auto sm:mx-0">
              Align 4 Paper Columns inside Blue Guidelines
            </span>
          </div>
        </div>
      ) : (
        /* Rule of Thirds 3x3 Grid */
        <div className="w-full h-full border border-cyan-400/40 rounded-xl relative p-2 bg-cyan-950/10">
          <div className="absolute inset-x-0 top-1/3 border-b border-dashed border-cyan-400/45" />
          <div className="absolute inset-x-0 top-2/3 border-b border-dashed border-cyan-400/45" />
          <div className="absolute inset-y-0 left-1/3 border-r border-dashed border-cyan-400/45" />
          <div className="absolute inset-y-0 left-2/3 border-r border-dashed border-cyan-400/45" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 border border-cyan-400 rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
};

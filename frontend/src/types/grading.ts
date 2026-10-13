export interface ChoiceOption {
  id: string;
  fill_ratio: number;
  is_marked: boolean;
  bbox?: [number, number, number, number];
}

export interface QuestionAnswer {
  question_number: number;
  local_question_number?: number;
  section: string;
  correct_answer: string;
  student_answer: string | null;
  status: "correct" | "incorrect" | "unanswered" | "ambiguous";
  confidence: number;
  needs_review: boolean;
  points_awarded: number;
  points_possible: number;
  choices: ChoiceOption[];
  notes?: string | null;
}

export interface SectionSummary {
  section_name: string;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  ambiguous_count: number;
  score: number;
  max_score: number;
  percentage: number;
}

export interface GradingRules {
  points_per_correct: number;
  points_per_incorrect: number;
  points_per_unanswered: number;
  points_per_ambiguous: number;
  allow_multiple_answers: boolean;
  fill_threshold: number;
  uncertain_lower_threshold: number;
  ambiguity_margin: number;
}

export interface AnswerKeyData {
  title: string;
  description?: string | null;
  total_questions: number;
  sections: string[];
  answers: Record<string, string>;
  section_mapping: Record<string, string>;
  choices_per_question: number;
  is_verified: boolean;
}

export interface GradingResult {
  session_id: string;
  student_name: string;
  control_number?: string | null;
  total_questions: number;
  total_score: number;
  max_score: number;
  percentage: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  ambiguous_count: number;
  needs_review_count: number;
  sections: SectionSummary[];
  questions: QuestionAnswer[];
  annotated_image_url?: string | null;
  warped_image_url?: string | null;
  processing_time_ms: number;
}

export type GradingStep =
  | "upload-key"
  | "verify-key"
  | "scan-sheet"
  | "review-detection"
  | "results";

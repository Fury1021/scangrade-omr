import { AnswerKeyData } from "@/types/grading";

export const SAMPLE_AISCC_KEY: AnswerKeyData = {
  title: "AISCC Qualifying Examination Answer Key",
  description: "Official 4-column vector exam answer sheet (160 Questions across 4 subjects).",
  total_questions: 160,
  sections: [
    "General Information",
    "Logical Reasoning",
    "Mathematics",
    "English"
  ],
  answers: {
    "1": "B", "2": "C", "3": "A", "4": "B", "5": "A", "6": "D", "7": "B", "8": "C", "9": "A", "10": "D",
    "11": "C", "12": "B", "13": "A", "14": "C", "15": "C", "16": "D", "17": "A", "18": "C", "19": "B", "20": "A",
    "21": "C", "22": "D", "23": "C", "24": "B", "25": "A", "26": "B", "27": "C", "28": "D", "29": "B", "30": "A",
    "31": "B", "32": "B", "33": "C", "34": "C", "35": "B", "36": "A", "37": "A", "38": "C", "39": "BLANK", "40": "C",
    "41": "A", "42": "D", "43": "C", "44": "C", "45": "B", "46": "A", "47": "C", "48": "B", "49": "B", "50": "A",
    "51": "C", "52": "D", "53": "C", "54": "B", "55": "A", "56": "B", "57": "C", "58": "C", "59": "D", "60": "C",
    "61": "A", "62": "A", "63": "B", "64": "B", "65": "D", "66": "B", "67": "A", "68": "B", "69": "B", "70": "C",
    "71": "C", "72": "D", "73": "C", "74": "B", "75": "A", "76": "B", "77": "A", "78": "B", "79": "C", "80": "D",
    "81": "A", "82": "B", "83": "C", "84": "B", "85": "A", "86": "B", "87": "C", "88": "B", "89": "C", "90": "B",
    "91": "B", "92": "A", "93": "B", "94": "D", "95": "C", "96": "B", "97": "A", "98": "A", "99": "B", "100": "C",
    "101": "C", "102": "B", "103": "A", "104": "B", "105": "C", "106": "B", "107": "B", "108": "D", "109": "C", "110": "A",
    "111": "B", "112": "B", "113": "D", "114": "C", "115": "B", "116": "B", "117": "B", "118": "C", "119": "B", "120": "A",
    "121": "A", "122": "D", "123": "A", "124": "B", "125": "B", "126": "C", "127": "D", "128": "D", "129": "C", "130": "C",
    "131": "B", "132": "A", "133": "B", "134": "B", "135": "C", "136": "B", "137": "A", "138": "A", "139": "B", "140": "C",
    "141": "B", "142": "A", "143": "C", "144": "B", "145": "B", "146": "A", "147": "B", "148": "C", "149": "D", "150": "C",
    "151": "B", "152": "A", "153": "A", "154": "B", "155": "C", "156": "D", "157": "D", "158": "C", "159": "B", "160": "C"
  },
  section_mapping: {
    ...Object.fromEntries(Array.from({ length: 40 }, (_, i) => [(i + 1).toString(), "General Information"])),
    ...Object.fromEntries(Array.from({ length: 40 }, (_, i) => [(i + 41).toString(), "Logical Reasoning"])),
    ...Object.fromEntries(Array.from({ length: 40 }, (_, i) => [(i + 81).toString(), "Mathematics"])),
    ...Object.fromEntries(Array.from({ length: 40 }, (_, i) => [(i + 121).toString(), "English"]))
  },
  choices_per_question: 4,
  is_verified: true
};

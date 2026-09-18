import type { SelectionMode } from "@prisma/client";

/**
 * Satu baris aturan: dari topik ini, ambil sejumlah soal secara acak.
 *
 * Penyaring tingkat kesulitan sengaja belum ada di sini. Bank soal sudah dapat
 * disaring per kesulitan, dan menambahkannya ke aturan akan melipatgandakan
 * kombinasi yang harus dijelaskan kepada trainer tanpa manfaat yang jelas
 * dulu. Bentuknya persis apa yang dihasilkan formulir — tidak ada kolom yang
 * tersimpan tetapi tidak pernah dipakai.
 */
export type SelectionRule = { topic: string; count: number };

/** Soal sebagaimana dibutuhkan pemilihan: identitas, topik, urutan stabil. */
export type SelectableQuestion = { id: string; topic: string };

export type RuleOutcome = {
  topic: string;
  requested: number;
  taken: number;
};

export type Selection<T extends SelectableQuestion> = {
  questions: T[];
  /** Apa yang benar-benar didapat per aturan, untuk dilaporkan ke trainer. */
  outcomes: RuleOutcome[];
};

/** Pengacak dapat disuntik agar hasilnya dapat diuji. */
export type Shuffle = <T>(items: T[]) => T[];

export function shuffleInPlace<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Topik yang ada di bank soal beserta jumlahnya, untuk menggambar formulir. */
export function topicCounts(bank: SelectableQuestion[]) {
  const counts = new Map<string, number>();
  for (const question of bank)
    counts.set(question.topic, (counts.get(question.topic) ?? 0) + 1);
  return [...counts.entries()]
    .map(([topic, available]) => ({ topic, available }))
    .sort((a, b) => a.topic.localeCompare(b.topic, "id"));
}

/**
 * Menerapkan aturan per topik terhadap bank soal.
 *
 * Ketika sebuah topik tidak lagi punya cukup soal — misalnya beberapa soal
 * diarsipkan setelah aturan disusun — yang tersedia tetap diambil dan
 * kekurangannya dilaporkan lewat `outcomes`. Menolak memulai ujian karena satu
 * topik kekurangan dua soal merugikan peserta yang sudah duduk di kelas;
 * yang perlu tahu adalah trainer, dan itulah gunanya laporan tersebut.
 */
export function applyRules<T extends SelectableQuestion>(
  rules: SelectionRule[],
  bank: T[],
  shuffle: Shuffle = shuffleInPlace,
): Selection<T> {
  const byTopic = new Map<string, T[]>();
  for (const question of bank) {
    const list = byTopic.get(question.topic);
    if (list) list.push(question);
    else byTopic.set(question.topic, [question]);
  }

  const questions: T[] = [];
  const outcomes: RuleOutcome[] = [];

  for (const rule of rules) {
    if (rule.count <= 0) continue;
    const available = byTopic.get(rule.topic) ?? [];
    const taken = shuffle(available).slice(0, rule.count);
    questions.push(...taken);
    outcomes.push({
      topic: rule.topic,
      requested: rule.count,
      taken: taken.length,
    });
  }

  // Urutan topik tidak boleh membocorkan struktur aturan kepada peserta:
  // tanpa pengacakan akhir, semua soal Klausul 4 selalu muncul berurutan.
  return { questions: shuffle(questions), outcomes };
}

/**
 * Memilih paket soal untuk satu percobaan.
 *
 * `manual` adalah daftar yang disusun trainer, sudah dalam urutannya. Pada mode
 * MANUAL urutan itu dipertahankan kecuali pengacakan soal dinyalakan — trainer
 * yang menyusun urutan biasanya memang memaksudkannya.
 */
export function selectQuestions<T extends SelectableQuestion>(
  {
    mode,
    rules,
    limit,
    randomize,
  }: {
    mode: SelectionMode;
    rules: SelectionRule[];
    limit: number | null;
    randomize: boolean;
  },
  { manual, bank }: { manual: T[]; bank: T[] },
  shuffle: Shuffle = shuffleInPlace,
): Selection<T> {
  if (mode === "MANUAL") {
    const questions = randomize ? shuffle(manual) : manual;
    return { questions, outcomes: [] };
  }

  if (mode === "RULES") return applyRules(rules, bank, shuffle);

  const ordered = randomize ? shuffle(bank) : bank;
  return {
    questions: limit && limit > 0 ? ordered.slice(0, limit) : ordered,
    outcomes: [],
  };
}

/** Membaca selectionRules dari kolom Json, mengabaikan bentuk yang rusak. */
export function parseRules(value: unknown): SelectionRule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { topic, count } = entry as Record<string, unknown>;
    if (typeof topic !== "string" || !topic.trim()) return [];
    const parsed = Number(count);
    if (!Number.isInteger(parsed) || parsed <= 0) return [];
    return [{ topic, count: Math.min(parsed, 200) }];
  });
}

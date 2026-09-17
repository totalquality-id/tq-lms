export type EvaluationQuestion = {
  id: string;
  category: string;
  text: string;
  type: "RATING" | "TEXT";
};

/**
 * Formulir evaluasi baku Total Quality. Disalin ke dalam TrainingEvaluation
 * saat evaluasi dibuka, sehingga menyempurnakan daftar ini tidak mengubah
 * jawaban pelatihan yang sudah berjalan.
 *
 * Berada di lib, bukan di services, karena seed pengembangan juga memakainya
 * dan seed berjalan di luar lingkungan server Next.js.
 */
export const EVALUATION_TEMPLATE: EvaluationQuestion[] = [
  {
    id: "content-relevance",
    category: "Materi pelatihan",
    text: "Seberapa relevan materi dengan pekerjaan Anda?",
    type: "RATING",
  },
  {
    id: "content-depth",
    category: "Materi pelatihan",
    text: "Seberapa memadai kedalaman materi yang disampaikan?",
    type: "RATING",
  },
  {
    id: "trainer-clarity",
    category: "Trainer",
    text: "Seberapa jelas trainer menjelaskan materi?",
    type: "RATING",
  },
  {
    id: "trainer-mastery",
    category: "Trainer",
    text: "Seberapa baik penguasaan trainer atas materi?",
    type: "RATING",
  },
  {
    id: "delivery-pace",
    category: "Penyelenggaraan",
    text: "Seberapa sesuai alokasi waktu dan alur pelatihan?",
    type: "RATING",
  },
  {
    id: "facility",
    category: "Fasilitas",
    text: "Seberapa mendukung fasilitas dan sarana pelatihan?",
    type: "RATING",
  },
  {
    id: "overall",
    category: "Kepuasan keseluruhan",
    text: "Seberapa puas Anda terhadap pelatihan ini secara keseluruhan?",
    type: "RATING",
  },
  {
    id: "improvement",
    category: "Masukan",
    text: "Apa yang dapat kami perbaiki pada pelatihan berikutnya?",
    type: "TEXT",
  },
];

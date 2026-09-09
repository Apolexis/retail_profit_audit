export type ImportStage = "idle" | "reading" | "checking" | "ready" | "saving" | "done" | "error";

export const importStatusMeta: Record<ImportStage, { step: number; label: string; file: string; check: string; write: string }> = {
  idle: { step: 0, label: "Ожидаем книгу", file: "ожидание", check: "после выбора файла", write: "после подтверждения" },
  reading: { step: 1, label: "Читаем файл", file: "читаем из браузера", check: "после выбора файла", write: "после подтверждения" },
  checking: { step: 2, label: "Проверяем структуру и совпадения", file: "книга выбрана", check: "распознаем листы и даты", write: "после подтверждения" },
  ready: { step: 2, label: "Файл проверен — выберите даты и действие", file: "книга выбрана", check: "предпросмотр готов", write: "после подтверждения" },
  saving: { step: 3, label: "Записываем выбранные факты", file: "книга выбрана", check: "предпросмотр готов", write: "сохраняем выбранные даты" },
  done: { step: 3, label: "Импорт завершен", file: "книга выбрана", check: "предпросмотр готов", write: "готово" },
  error: { step: 0, label: "Нужно исправить ошибку", file: "ошибка", check: "повторите выбор файла", write: "не начато" },
};

export const isImportBusy = (stage: ImportStage) => stage === "reading" || stage === "checking" || stage === "saving";

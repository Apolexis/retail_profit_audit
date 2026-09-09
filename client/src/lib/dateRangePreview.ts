import { differenceInCalendarDays, format } from "date-fns";
import { ru } from "date-fns/locale";

export function dateRangePreview(draftStart: Date | undefined, draftEnd: Date | undefined, saved: { from: Date; to: Date }) {
  if (!draftStart) {
    return {
      eyebrow: "ТЕКУЩИЙ ПЕРИОД",
      title: `${format(saved.from, "d MMMM yyyy", { locale: ru })} — ${format(saved.to, "d MMMM yyyy", { locale: ru })}`,
      detail: `${differenceInCalendarDays(saved.to, saved.from) + 1} календарных дн.`,
    };
  }
  if (!draftEnd) {
    return {
      eyebrow: "ПРЕДПРОСМОТР ВЫБОРА",
      title: format(draftStart, "d MMMM yyyy", { locale: ru }),
      detail: "Наведите или выберите дату конца",
    };
  }
  return {
    eyebrow: "ПРЕДПРОСМОТР ВЫБОРА",
    title: `${format(draftStart, "d MMMM yyyy", { locale: ru })} — ${format(draftEnd, "d MMMM yyyy", { locale: ru })}`,
    detail: `${differenceInCalendarDays(draftEnd, draftStart) + 1} календарных дн.`,
  };
}

import { describe, expect, it } from "vitest";
import { formatRussianPhone, normalizeRussianPhone, removePhoneDigitAtCursor } from "./phone";

describe("российский телефон",()=>{
  it("принимает номер, начатый с 9, 7 или 8",()=>{expect(normalizeRussianPhone("9537573636")).toBe("79537573636");expect(normalizeRussianPhone("79537573636")).toBe("79537573636");expect(normalizeRussianPhone("89537573636")).toBe("79537573636");});
  it("показывает единый формат без двойной семерки",()=>{expect(formatRussianPhone("79537573636")).toBe("+7 (953) 757-36-36");expect(formatRussianPhone("7")).toBe("+7");});
  it("удаляет цифру, а не застревает на скобке, пробеле или дефисе",()=>{const value="79537573636";const shown=formatRussianPhone(value);expect(removePhoneDigitAtCursor(value,shown,3,3,"delete")).toBe("7537573636");expect(removePhoneDigitAtCursor(value,shown,8,8,"backspace")).toBe("7957573636");expect(removePhoneDigitAtCursor(value,shown,8,8,"delete")).toBe("7953573636");expect(removePhoneDigitAtCursor(value,shown,12,12,"backspace")).toBe("7953753636");expect(removePhoneDigitAtCursor(value,shown,12,12,"delete")).toBe("7953757636");});
});

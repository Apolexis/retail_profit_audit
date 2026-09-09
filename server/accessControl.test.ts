import { describe, expect, it } from "vitest";
import { isAccessLevelAllowed } from "./accessControl";

describe("гранулярные права магазина", () => {
  it("разрешает просмотр для просмотра и редактирования", () => {
    expect(isAccessLevelAllowed("view", "view")).toBe(true);
    expect(isAccessLevelAllowed("edit", "view")).toBe(true);
  });
  it("не дает редактировать при праве только на просмотр", () => {
    expect(isAccessLevelAllowed("view", "edit")).toBe(false);
    expect(isAccessLevelAllowed(undefined, "view")).toBe(false);
    expect(isAccessLevelAllowed(undefined, "edit")).toBe(false);
  });
  it("дает редактирование только с уровнем edit", () => {
    expect(isAccessLevelAllowed("edit", "edit")).toBe(true);
  });
});

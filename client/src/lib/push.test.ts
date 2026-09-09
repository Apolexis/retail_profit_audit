import { describe, expect, it } from "vitest";
import { vapidKeyToBytes } from "./push";

describe("VAPID public key",()=>{
  it("преобразует URL-safe base64 в байты для PushManager",()=>{
    expect(Array.from(vapidKeyToBytes("AQIDBA"))).toEqual([1,2,3,4]);
  });
});

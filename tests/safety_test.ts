import { sanitizeResponse } from "../src/services/safety.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

Deno.test("sanitizeResponse removes explicit referee intro", () => {
  assertEquals(
    sanitizeResponse("ကဲကဲ referee ဝင်ပေးမယ်။ နှစ်ဖက်လုံးနားထောင်ကြည့်ရင် A ကပိုမှန်တယ်။", 0),
    "နှစ်ဖက်လုံးနားထောင်ကြည့်ရင် A ကပိုမှန်တယ်။",
  );
});

Deno.test("sanitizeResponse does not truncate when maxLength is zero", () => {
  const text = "အဖြေ ".repeat(500);
  assertEquals(sanitizeResponse(text, 0), text.trim());
});

Deno.test("sanitizeResponse removes damaged trailing partial Burmese sentence", () => {
  assertEquals(
    sanitizeResponse("ဒီမှာ serious မဖြစ်သင့်ဘူး။ ကစားပွဲဆိ�", 0),
    "ဒီမှာ serious မဖြစ်သင့်ဘူး။",
  );
});

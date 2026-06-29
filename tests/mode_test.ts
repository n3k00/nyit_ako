import { selectResponseMode } from "../src/services/mode.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

Deno.test("selectResponseMode chooses supportive before humor", () => {
  assertEquals(selectResponseMode("စိတ်ညစ်နေတာ roast မလုပ်နဲ့"), "supportive");
});

Deno.test("selectResponseMode identifies helpful requests", () => {
  assertEquals(selectResponseMode("ဒီ api error ဘယ်လို fix လုပ်ရမလဲ"), "helpful");
});

Deno.test("selectResponseMode identifies referee requests", () => {
  assertEquals(selectResponseMode("သူတို့နှစ်ယောက် ဘယ်သူမှန်လဲ ဆုံးဖြတ်ပေး"), "referee");
});

Deno.test("selectResponseMode identifies banter", () => {
  assertEquals(selectResponseMode("rank game မှာ နောက်လို့ရမလား lol"), "banter");
});

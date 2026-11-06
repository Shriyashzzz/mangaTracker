// All of this runs on made-up keys and answers: no real search is ever spent
import {
  readAnswer,
  searchWithKeys,
  serpApiKeys,
  usageLabel,
  type KeyAnswer,
} from "../../prices/providers/serpapiKeys.js";

test("keys can be listed any of the ways people write them", () => {
  expect(serpApiKeys({ SERPAPI_API_KEY: "a" })).toEqual(["a"]);
  expect(
    serpApiKeys({ SERPAPI_API_KEY: "a", SERPAPI_API_KEYS: "b, c ,,a" }),
  ).toEqual(["a", "b", "c"]);
  expect(
    serpApiKeys({
      SERPAPI_API_KEY_10: "z",
      SERPAPI_API_KEY_2: "b",
      SERPAPI_KEY3: "c",
      SERPAPI_API_KEY: "a",
      SERPAPI_MONTHLY_LIMIT: "250",
      OTHER: "no",
    }),
  ).toEqual(["a", "b", "z", "c"]);
  expect(serpApiKeys({})).toEqual([]);
});

test("the main key keeps its count, and no label gives a key away", () => {
  expect(usageLabel("main-secret", "main-secret")).toBe("serpapi");
  const label = usageLabel("other-secret", "main-secret");
  expect(label).toMatch(/^serpapi-[0-9a-f]{12}$/);
  expect(label).not.toContain("secret");
  expect(label.length).toBeLessThanOrEqual(40); // the column's size
  expect(usageLabel("other-secret", "main-secret")).toBe(label);
});

test("SerpApi's answers are told apart", () => {
  expect(readAnswer(200)).toBe("ok");
  expect(readAnswer(429, "Your account has run out of searches.")).toBe(
    "out-of-searches",
  );
  expect(readAnswer(429, "exceeds the hourly throughput limit")).toBe("skip");
  expect(readAnswer(401, "Invalid API key")).toBe("skip");
  expect(readAnswer(500, "boom")).toBe("error");
  expect(readAnswer(200, "Google hasn't returned any results")).toBe("ok");
  expect(readAnswer(200, "something else went wrong")).toBe("error");
});

const run = (
  answers: Record<string, KeyAnswer>,
  allowance: Record<string, boolean> = {},
) => {
  const searched: string[] = [];
  const spent: string[] = [];
  return {
    searched,
    spent,
    result: searchWithKeys({
      keys: Object.keys(answers),
      claim: async (key) => allowance[key] ?? true,
      markSpent: async (key) => void spent.push(key),
      search: async (key) => {
        searched.push(key);
        return { answer: answers[key]!, data: `from ${key}`, error: "nope" };
      },
    }),
  };
};

test("the first key does the work while it can", async () => {
  const r = run({ a: "ok", b: "ok" });
  expect(await r.result).toBe("from a");
  expect(r.searched).toEqual(["a"]);
});

test("a key at its own limit is passed over without being searched", async () => {
  const r = run({ a: "ok", b: "ok" }, { a: false });
  expect(await r.result).toBe("from b");
  expect(r.searched).toEqual(["b"]);
});

test("when SerpApi says a key is out, it's marked spent and the next takes over", async () => {
  const r = run({ a: "out-of-searches", b: "ok" });
  expect(await r.result).toBe("from b");
  expect(r.spent).toEqual(["a"]);
});

test("a rate limited or bad key is skipped for now, not written off", async () => {
  const r = run({ a: "skip", b: "ok" });
  expect(await r.result).toBe("from b");
  expect(r.spent).toEqual([]);
});

test("with every key used up there's simply no answer", async () => {
  const r = run({ a: "out-of-searches", b: "skip" }, {});
  expect(await r.result).toBeNull();
  const none = run({ a: "ok", b: "ok" }, { a: false, b: false });
  expect(await none.result).toBeNull();
  expect(none.searched).toEqual([]);
});

test("any other failure stops there rather than burning the other keys", async () => {
  const r = run({ a: "error", b: "ok" });
  await expect(r.result).rejects.toThrow("SerpApi: nope");
  expect(r.searched).toEqual(["a"]);
});

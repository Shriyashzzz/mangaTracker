import { isCloudflare, visitorIp } from "../../../../client/visitorIp.js";

test("Cloudflare's addresses are known, others aren't", () => {
  expect(isCloudflare("104.16.1.1")).toBe(true);
  expect(isCloudflare("172.71.150.20")).toBe(true);
  expect(isCloudflare("::ffff:162.158.90.3")).toBe(true);
  expect(isCloudflare("2606:4700:10::6816:101")).toBe(true);
  expect(isCloudflare("2a06:98c7::1")).toBe(true);
  expect(isCloudflare("8.8.8.8")).toBe(false);
  expect(isCloudflare("172.72.0.1")).toBe(false);
  expect(isCloudflare("2001:db8::1")).toBe(false);
  expect(isCloudflare(undefined)).toBe(false);
});

test("the named visitor is believed only from Cloudflare", () => {
  expect(visitorIp("104.16.1.1", "203.0.113.9")).toBe("203.0.113.9");
  // sent straight to the host with a made-up header: the real address counts
  expect(visitorIp("198.51.100.7", "203.0.113.9")).toBe("198.51.100.7");
  expect(visitorIp("104.16.1.1", undefined)).toBe("104.16.1.1");
  expect(visitorIp("104.16.1.1", "not an ip; drop table")).toBe("104.16.1.1");
});

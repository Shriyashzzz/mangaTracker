// Who the visitor is, for the API's rate limits. The site sits behind
// Cloudflare, so the address that reaches us is one of Cloudflare's, shared by
// everyone it serves: limits counted on it lump strangers together (ten
// sign-ins in five minutes between them all) and spread one attacker thin.
// Cloudflare names the real visitor in CF-Connecting-IP; it's believed only
// when the connection really came from Cloudflare (its published ranges,
// https://www.cloudflare.com/ips/), so a request sent straight to the host
// can't make up an address to dodge a limit.
const V4 = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
];
// every one is /32 but 2a06:98c0::/29
const V6 = [
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

const v4Number = (ip: string) => {
  const parts = ip.split(".").map(Number);
  return parts.length === 4 &&
    parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 255)
    ? ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>>
        0
    : null;
};
// the first 32 bits of an IPv6 address (all a /29 or /32 needs)
const v6Head = (ip: string) => {
  const groups = ip.split(":");
  if (groups.length < 3 || !groups[0] || !groups[1]) return null;
  const a = Number.parseInt(groups[0], 16);
  const b = Number.parseInt(groups[1], 16);
  return Number.isNaN(a) || Number.isNaN(b) ? null : ((a << 16) | b) >>> 0;
};
const within = (value: number, base: number, bits: number) =>
  bits === 0 || value >>> (32 - bits) === base >>> (32 - bits);

export function isCloudflare(address: string | undefined) {
  if (!address) return false;
  // "::ffff:104.16.0.1" is the IPv4 address
  const ip = address.replace(/^::ffff:/i, "");
  const four = v4Number(ip);
  if (four !== null)
    return V4.some((range) => {
      const [base, bits] = range.split("/");
      return within(four, v4Number(base!)!, Number(bits));
    });
  const six = v6Head(ip);
  return (
    six !== null &&
    V6.some((range) => {
      const [base, bits] = range.split("/");
      return within(six, v6Head(base!)!, Number(bits));
    })
  );
}

// `connected`: the address that reached us (req.ip); `named`: the
// CF-Connecting-IP header
export const visitorIp = (
  connected: string | undefined,
  named: string | undefined,
) => {
  const real = named?.trim();
  return real && /^[0-9a-f.:]{3,45}$/i.test(real) && isCloudflare(connected)
    ? real
    : (connected ?? "");
};

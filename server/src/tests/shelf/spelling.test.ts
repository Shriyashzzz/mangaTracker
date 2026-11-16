// The server's spelling rule (util/shelf/spelling.ts) is a copy of the
// page's (client/src/lib/nearMatches.ts): the two must answer the same
import * as server from "../../util/shelf/spelling.js";
import * as client from "../../../../client/src/lib/nearMatches.js";

const pairs: [string, string][] = [
  ["chainsw man", "Chainsaw Man"],
  ["one peice", "One Piece"],
  ["one peice", "One Punch-Man"],
  ["vinland sga", "Vinland Saga"],
  ["berserkk", "Berserk of Gluttony"],
  ["frieren beyond journys end", "Frieren: Beyond Journey’s End"],
  ["zzqqxx nothing", "Knowing Nothing"],
  ["naruto", "Boruto"],
];

test("the server and the page agree on what's near enough", () => {
  for (const [typed, name] of pairs)
    expect([typed, name, server.closeEnough(typed, name)]).toEqual([
      typed,
      name,
      client.closeEnough(typed, name),
    ]);
  for (const [a, b] of [
    ["peice", "piece"],
    ["chainsw", "chainsaw"],
    ["zzqqxx", "nothing"],
  ] as const)
    expect(server.slipsBetween(a, b)).toBe(client.slipsBetween(a, b));
});

test("the closest name comes first", () => {
  expect(server.slipsInName("chainsw man", "Chainsaw Man")).toBe(1);
  expect(server.slipsInName("one peice", "One Piece")).toBe(1);
  expect(server.slipsInName("one piece", "One Piece")).toBe(0);
});

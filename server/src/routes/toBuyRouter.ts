// /api/to-buy/*  a reader's To buy list. Signed in only
import { Router } from "express";
import toBuy from "../controllers/toBuyController.js";
import { rateLimit } from "../middlewares/rateLimit.js";

const perMinute = (max: number) => rateLimit({ max, windowMs: 60_000 });

export const toBuyRouter = Router();

// asked once per visit, and again after each change
toBuyRouter.get("/", perMinute(120), toBuy.list);
// one tap each, like owning a volume
toBuyRouter.put("/:isbn", perMinute(60), toBuy.add);
toBuyRouter.delete("/:isbn", perMinute(60), toBuy.remove);
// "I bought it", "I ordered it": off the list, and on the shelf when certain
toBuyRouter.post("/:isbn/settle", perMinute(60), toBuy.settle);
// the whole list at once: asked for on purpose, twice (the page confirms)
toBuyRouter.delete("/", perMinute(10), toBuy.clear);

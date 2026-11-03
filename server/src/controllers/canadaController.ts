// GET /api/prices/ca/:isbn: one volume's Canadian prices (see prices/canada)
import type { Request, Response } from "express";
import { getCanadaPrices } from "../prices/canada/canadaPrices.js";
import { sendError } from "../middlewares/errorHandler.js";

export default async function canadaPrices(req: Request, res: Response) {
  const isbn = String(req.params.isbn ?? "");
  if (!/^97[89]\d{10}$/.test(isbn)) {
    sendError(res, 400, "That isn't an ISBN-13.");
    return;
  }
  try {
    res.json(await getCanadaPrices(isbn));
  } catch (e) {
    console.error("Canadian prices failed", e);
    res.json({ status: "error", offers: [], checkedAt: null, links: [] });
  }
}

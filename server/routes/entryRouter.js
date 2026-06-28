import { Router } from "express";
import { checkIfValidSignIn } from "../controller/checkIfValidSignIn.js";
export const mangaEntryRouter = Router();

mangaEntryRouter.post("/login", checkIfValidSignIn);
mangaEntryRouter.get("/api/me", (req, res) => {
  if (req.session.userId) {
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
  }
});

mangaEntryRouter.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.sendStatus(500);
      return;
    } else {
      res.sendStatus(200);
    }
  });
});
export default { mangaEntryRouter };

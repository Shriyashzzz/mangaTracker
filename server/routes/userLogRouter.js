import { Router } from "express";
import { checkIfValidSignIn } from "../controller/checkIfValidSignIn.js";
import { signUpController } from "../controller/signUpController.js";

export const mangaEntryRouter = Router();

mangaEntryRouter.post("/login", checkIfValidSignIn);
mangaEntryRouter.get("/api/me", (req, res) => {
  //checks if the user's userId is currently in the session store
  if (req.session.userId) {
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
  }
});

mangaEntryRouter.get("/logout", (req, res) => {
  // destroys the user's session from the session store and clears their auth state
  req.session.destroy((err) => {
    if (err) {
      res.sendStatus(500);
      return;
    } else {
      res.sendStatus(200);
    }
  });
});

mangaEntryRouter.post("/signup", signUpController);

export default { mangaEntryRouter };

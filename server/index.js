import express from "express";
import path from "node:path";
import cors from "cors";
import mangaRouter from "./routes/managaRouter.js";
import { mangaDetailRouter } from "./routes/mangaDetailRouter.js";
import { mangaUpdateRouter } from "./routes/mangaUpdateRouter.js";
const app = express();
const port = process.env.PORT || 8080;
//allwoing all  access only for dev mode, enable set allowed origins later in production
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// write your routers
app.use("/api/mangadata", mangaRouter.mangaHomeRouter);
app.use("/details/:id", mangaDetailRouter);
app.use("/update/:id", mangaUpdateRouter);
app.listen(port, () => {
  console.log(`server running on http://localhost:${port} `);
});

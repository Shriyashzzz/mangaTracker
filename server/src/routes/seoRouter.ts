// /sitemap.xml and /robots.txt at the API's root
import { Router } from "express";
import seo from "../controllers/seoController.js";

export const seoRouter = Router();
seoRouter.get("/sitemap.xml", seo.sitemap);
seoRouter.get("/robots.txt", seo.robots);

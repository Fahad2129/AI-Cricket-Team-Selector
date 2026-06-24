import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cricketRouter from "./cricket";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/cricket", cricketRouter);

export default router;

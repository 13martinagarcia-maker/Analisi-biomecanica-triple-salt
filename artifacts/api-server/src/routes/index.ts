import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import athleteRouter from "./athletes";
import competitionRouter from "./competitions";
import trackEvaluationRouter from "./track-evaluations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(athleteRouter);
router.use(competitionRouter);
router.use(trackEvaluationRouter);

export default router;

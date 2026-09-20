import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import athleteRouter from "./athletes";
import competitionRouter from "./competitions";
import trackEvaluationRouter from "./track-evaluations";
import homeAnalysisRouter from "./home-analyses";
import athleteMediaRouter from "./athlete-media";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(athleteRouter);
router.use(competitionRouter);
router.use(trackEvaluationRouter);
router.use(homeAnalysisRouter);
router.use(athleteMediaRouter);

export default router;

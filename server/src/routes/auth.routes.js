import { Router } from "express";

import { registerWorkspace } from "../controllers/auth.controller.js";
import { validateWorkspaceRegistration } from "../middleware/validateWorkspaceRegistration.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post(
    "/register-workspace",
    validateWorkspaceRegistration,
    asyncHandler(registerWorkspace)
);

export default router;
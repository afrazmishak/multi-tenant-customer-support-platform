import { Router } from "express";

import { login, registerWorkspace, } from "../controllers/auth.controller.js";
import { validateLogin } from "../middleware/validateLogin.middleware.js";
import { validateWorkspaceRegistration } from "../middleware/validateWorkspaceRegistration.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post(
    "/register-workspace",
    validateWorkspaceRegistration,
    asyncHandler(registerWorkspace)
);

router.post(
    "/login",
    validateLogin,
    asyncHandler(login)
);

export default router;
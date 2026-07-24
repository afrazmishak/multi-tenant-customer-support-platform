import { Router } from "express";

import { getMe, login, logout, registerWorkspace, } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/authenticate.middleware.js";
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

router.get(
    "/me",
    authenticate,
    asyncHandler(getMe)
);

router.post(
    "/logout",
    logout
);

export default router;
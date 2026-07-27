import "dotenv/config";

import {
    connectDatabase,
    disconnectDatabase,
} from "../config/database.js";
import { initializeModels } from "../models/index.js";

async function checkModels() {
    try {
        await connectDatabase();
        await initializeModels();

    } catch (error) {
        process.exitCode = 1;
    } finally {
        await disconnectDatabase();
    }
}

checkModels();
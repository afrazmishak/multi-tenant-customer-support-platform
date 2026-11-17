import mongoose from "mongoose"

export async function connectDatabase() {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error(
            "MONGODB_URI is not defined in the environment variables"
        );
    }

    if (process.env.NODE_ENV === "test") {
        throw new Error(
            "Test mode must use an explicitly configured, isolated test database connection"
        );
    }

    mongoose.set("strictQuery", true);

    const connection = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
    });

    console.log(
        `MongoDB connected: ${connection.connection.host}/${connection.connection.name}`
    );

    return connection;
}
export async function disconnectDatabase() {
    await mongoose.connection.close();
}
import bcrypt from "bcryptjs"

function getBcryptRounds() {
    const rounds = Number.parseInt(
        process.env.BCRYPT_ROUNDS || "12",
        10
    );

    if (!Number.isInteger(rounds) || rounds < 10 || rounds > 14) {
        throw new Error(
            "BCRYPT_ROUNDS must be an integer between 10 and 14"
        );
    }

    return rounds;
}

export function wouldTruncatePassword(password) {
    return bcrypt.truncates(password);
}

export async function hashPassword(password) {
    const rounds = getBcryptRounds();

    return bcrypt.hash(password, rounds);
}

export async function verifyPassword(password, passwordHash) {
    return bcrypt.compare(password, passwordHash)
}

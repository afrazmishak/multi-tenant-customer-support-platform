export async function authenticateSocket(socket, next) {
  try {
    // Read token

    // Verify token

    // Load user

    // Attach authenticated identity

    next();
  } catch (error) {
    next(new Error("Authentication required"));
  }
}

io.use(authenticateSocket);
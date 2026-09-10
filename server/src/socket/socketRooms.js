export function getWorkspaceRoom(tenantId) {
  if (!tenantId) {
    throw new Error(
      "A tenant ID is required to create a workspace room"
    );
  }

  return `workspace:${tenantId}`;
}

export function getTicketRoom(tenantId, ticketId) {
  if (!tenantId) {
    throw new Error(
      "A tenant ID is required to create a ticket room"
    );
  }

  if (!ticketId) {
    throw new Error(
      "A ticket ID is required to create a ticket room"
    );
  }

  return `workspace:${tenantId}:ticket:${ticketId}`;
}
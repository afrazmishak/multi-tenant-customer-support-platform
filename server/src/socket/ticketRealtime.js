//Importing from the Socket.IO server
import { getSocketServer } from './socket.js';

//Importing to generate a predictable room name
import { getTicketRoom } from "./socketRooms.js"

export function emitTicketMessageCreated({
    workspaceId,
    ticketId,
    message
}) {
    const io = getSocketServer();

    const ticketRoom = getTicketRoom(
        workspaceId,
        ticketId
    );

    io.to(ticketRoom).emit(
        "ticket:message:created",
        {
            ticketId,
            message
        }
    );
}
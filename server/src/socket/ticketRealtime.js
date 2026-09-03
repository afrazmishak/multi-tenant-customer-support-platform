//Importing from the Socket.IO server
import { getSocketServer } from './socket.js';

//Importing to generate a predictable room name
import { getTicketRoom, getWorkspaceRoom, } from "./socketRooms.js"

//emitTicketMessageCreated function represents created, a completely new message exists
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

//emitTicketMessageUpdated function represents updated, an existing message changed
export function emitTicketMessageUpdated({
    workspaceId,
    ticketId,
    message,
}) {
    const io = getSocketServer();

    const ticketRoom = getTicketRoom(
        workspaceId,
        ticketId
    );

    io.to(ticketRoom).emit(
        "ticket:message:updated",
        {
            ticketId,
            message,
        }
    );
}

export function emitTicketUpdated({
    workspaceId,
    ticket,
}) {
    const io = getSocketServer();

    const workspaceRoom = getWorkspaceRoom(workspaceId);

    io.to(workspaceRoom).emit(
        "ticket:updated",
        {
            ticket,
        }
    );
}
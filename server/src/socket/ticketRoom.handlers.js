import mongoose from "mongoose";

import { getTicketById } from "../services/ticket.service.js";
import { getTicketRoom } from "./socketRooms.js";

export function registerTicketRoomHandlers(socket) {
  socket.on(
    "ticket:join",
    async ({ ticketId } = {}, acknowledge) => {
      try {
        const tenantId =
          socket.data.tenantContext?.tenantId;

        if (!tenantId) {
          return acknowledge?.({
            success: false,
            code: "TENANT_CONTEXT_REQUIRED",
            message: "Workspace context is required",
          });
        }

        if (
          !ticketId ||
          !mongoose.isValidObjectId(ticketId)
        ) {
          return acknowledge?.({
            success: false,
            code: "INVALID_TICKET_ID",
            message: "A valid ticket ID is required",
          });
        }

        const ticket = await getTicketById({
          workspaceId: tenantId,
          ticketId,
        });

        const ticketRoom = getTicketRoom(
          tenantId,
          ticketId
        );

        await socket.join(ticketRoom);

        console.log(
          `Socket ${socket.id} joined ticket room ${ticketRoom}`
        );

        return acknowledge?.({
          success: true,
          ticketId: ticket.id ?? ticketId,
          room: ticketRoom,
        });
      } catch (error) {
        return acknowledge?.({
          success: false,
          code: "TICKET_SUBSCRIPTION_FAILED",
          message:
            error.message ||
            "Unable to subscribe to ticket",
        });
      }
    }
  );

  socket.on(
    "ticket:leave",
    async ({ ticketId } = {}, acknowledge) => {
      try {
        const tenantId =
          socket.data.tenantContext?.tenantId;

        if (
          !tenantId ||
          !ticketId ||
          !mongoose.isValidObjectId(ticketId)
        ) {
          return acknowledge?.({
            success: false,
            code: "INVALID_TICKET_ID",
            message: "A valid ticket ID is required",
          });
        }

        const ticketRoom = getTicketRoom(
          tenantId,
          ticketId
        );

        await socket.leave(ticketRoom);

        console.log(
          `Socket ${socket.id} left ticket room ${ticketRoom}`
        );

        return acknowledge?.({
          success: true,
          ticketId,
        });
      } catch (error) {
        return acknowledge?.({
          success: false,
          code: "TICKET_UNSUBSCRIBE_FAILED",
          message:
            error.message ||
            "Unable to unsubscribe from ticket",
        });
      }
    }
  );
}
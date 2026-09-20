import { useEffect } from "react";
import { Outlet, useParams } from "react-router";

import { socket } from "../socket/socket.js";

export default function WorkspaceSocketConnection() {
  const { workspaceSlug } = useParams();

  useEffect(() => {
    if (!workspaceSlug) {
      return;
    }

    function handleConnect() {
      console.log("Socket connected:", socket.id);
    }

    function handleDisconnect(reason) {
      console.log(
        "Socket disconnected:",
        reason
      );
    }

    // TEMPORARY TEST
    function handleConnectError(error) {
      console.error(
        "Socket connection failed:",
        error.message
      );

      console.error(
        "Socket error code:",
        error.data?.code
      );
    }

    function handleTicketMessageCreated(
      payload
    ) {
      console.log(
        "Real-time ticket message received:",
        payload
      );
    };

    function handleTicketMessageUpdated(
      payload
    ) {
      console.log(
        "Real-time ticket message updated:",
        payload
      );
    }

    function handleTicketUpdated(payload) {
      console.log(
        "Real-time ticket updated:",
        payload
      )
    }

    function handleUserOnline(payload) {
      console.log("User came online:", payload);
    }

    function handleUserOffline(payload) {
      console.log("User went offline:", payload);
    }

    socket.on(
      "ticket:message:created",
      handleTicketMessageCreated
    );

    socket.on(
      "ticket:message:updated",
      handleTicketMessageUpdated
    );

    socket.on(
      "ticket:updated",
      handleTicketUpdated
    );

    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "disconnect",
      handleDisconnect
    );

    socket.on(
      "presence:user:online",
      handleUserOnline
    );

    socket.on(
      "presence:user:offline",
      handleUserOffline
    );

    socket.on(
      "connect_error",
      handleConnectError
    );


    socket.auth = {
      workspaceSlug
    };

    socket.connect();

    return () => {
      socket.off(
        "ticket:message:created",
        handleTicketMessageCreated
      );

      socket.off(
        "ticket:message:updated",
        handleTicketMessageUpdated
      );

      socket.off(
        "ticket:updated",
        handleTicketUpdated
      );

      socket.off(
        "connect",
        handleConnect
      );

      socket.off(
        "disconnect",
        handleDisconnect
      );

      socket.off(
        "connect_error",
        handleConnectError
      );

      socket.off(
        "presence:user:online",
        handleUserOnline
      );

      socket.off(
        "presence:user:offline",
        handleUserOffline
      );

      socket.disconnect();
    };
  }, [workspaceSlug]);

  return <Outlet />;
}
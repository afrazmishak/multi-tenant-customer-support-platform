import { useEffect } from "react";
import { Outlet, useParams } from "react-router";

import { socket } from "./socket.js";

export default function WorkspaceSocketConnection() {
  const { workspaceSlug } = useParams();

  useEffect(() => {
    if (!workspaceSlug) {
      return;
    }

    function handleConnect() {
      console.log("Socket connected:", socket.id);
      socket.emit("workspace:test:broadcast");
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

    function handleWorkspaceTestEvent(payload) {
      console.log(
        "Workspace test event:",
        payload
      );
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("workspace:test:event", handleWorkspaceTestEvent);


    socket.auth = {
      workspaceSlug,
    };

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off(
        "disconnect",
        handleDisconnect
      );
      socket.off(
        "connect_error",
        handleConnectError
      );
      socket.off("workspace:test:event", handleWorkspaceTestEvent);
      socket.disconnect();
    };
  }, [workspaceSlug]);

  return <Outlet />;
}
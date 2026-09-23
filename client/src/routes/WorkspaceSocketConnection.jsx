import { useEffect, useState } from "react";
import { Outlet, useParams } from "react-router";

import { socket } from "../socket/socket.js";

export default function WorkspaceSocketConnection() {
  const { workspaceSlug } = useParams();

  const [presence, setPresence] = useState({
    workspaceSlug: null,
    userIds: [],
  });

  const onlineUserIds =
    presence.workspaceSlug === workspaceSlug
      ? presence.userIds
      : [];

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

      setPresence({
        workspaceSlug: null,
        userIds: [],
      })
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
      const userId = payload?.userId;

      if (!userId) {
        return;
      }

      const normalizedUserId = String(userId);

      setPresence((previous) => {
        if (previous.workspaceSlug !== workspaceSlug) {
          return previous;
        }

        if (previous.userIds.includes(normalizedUserId)) {
          return previous;
        }

        return {
          ...previous,
          userIds: [
            ...previous.userIds,
            normalizedUserId,
          ],
        };
      });

      console.log(
        "User came online:",
        payload
      );
    }



    function handleUserOffline(payload) {
      const userId = payload?.userId;

      if (!userId) {
        return;
      }

      const normalizedUserId = String(userId);

      setPresence((previous) => {
        if (previous.workspaceSlug !== workspaceSlug) {
          return previous;
        }

        return {
          ...previous,
          userIds: previous.userIds.filter(
            (id) => id !== normalizedUserId
          ),
        };
      });

      console.log(
        "User went offline:",
        payload
      );
    }


    function handlePresenceSnapshot(payload) {
      const userIds = Array.isArray(payload?.userIds)
        ? [...new Set(payload.userIds.map(String))]
        : [];

      setPresence({
        workspaceSlug,
        userIds,
      });

      console.log(
        "Initial presence snapshot:",
        userIds
      );
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
      "presence:snapshot",
      handlePresenceSnapshot
    )

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
        "presence:snapshot",
        handlePresenceSnapshot
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


  return (
    <>
      <section>
        <h3>
          Online Users ({onlineUserIds.length})
        </h3>

        {presence.workspaceSlug !== workspaceSlug ? (
          <p>Waiting for presence snapshot...</p>
        ) : onlineUserIds.length === 0 ? (
          <p>No users currently reported online.</p>
        ) : (
          <ul>
            {onlineUserIds.map((userId) => (
              <li key={userId}>
                🟢 {userId}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Outlet />
    </>
  );

}
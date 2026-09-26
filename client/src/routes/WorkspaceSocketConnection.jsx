import { useEffect, useState } from "react";
import { Outlet, useParams } from "react-router";
import { socket } from "../socket/socket.js";
import { WorkspacePresenceContext, } from "../context/WorkspacePresenceContext.js";

export default function WorkspaceSocketConnection() {
  const { workspaceSlug } = useParams();

  // Purpose: Who is online right now?
  const [presence, setPresence] = useState({
    workspaceSlug: null,
    userIds: [],
  });

  // Purpose: Who belongs to this workspace?
  const [directory, setDirectory] = useState({
    workspaceSlug: null,
    members: [],
    error: null
  });

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

  useEffect(() => {
    if (!workspaceSlug) {
      return
    }

    const controller = new AbortController();

    async function loadWorkspaceDirectory() {
      try {
        const response = await fetch(
          `http://localhost:5000/api/workspaces/${encodeURIComponent(workspaceSlug)}/directory`,
          {
            credentials: "include",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            `Directory request failed: ${response.status}`
          );
        }

        const result = await response.json();

        setDirectory({
          workspaceSlug,
          members: Array.isArray(result?.data?.members)
            ? result.data.members
            : [],
          error: null,
        });
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        setDirectory({
          workspaceSlug,
          members: [],
          error: error.message,
        });
      }
    }

    loadWorkspaceDirectory();

    return () => {
      controller.abort();
    };
  }, [workspaceSlug]);

  const presenceReady =
    presence.workspaceSlug === workspaceSlug;

  const directoryLoading =
    directory.workspaceSlug !== workspaceSlug;

  const workspaceMembers =
    directoryLoading
      ? []
      : directory.members;

  const onlineUserIds =
    presenceReady
      ? presence.userIds
      : [];

  const onlineUserSet =
    new Set(onlineUserIds);

  const membersWithPresence =
    workspaceMembers.map((member) => ({
      ...member,

      isOnline:
        presenceReady &&
        onlineUserSet.has(
          String(member.user.id)
        ),
    }));

  const onlineCount = presenceReady
    ? membersWithPresence.filter(
      (member) => member.isOnline
    ).length
    : 0;

  const workspacePresenceValue = {
    workspaceSlug,
    members: membersWithPresence,
    onlineCount,
    presenceReady,
    directoryLoading,

    directoryError: directoryLoading
      ? null
      : directory.error,
  };

  return (
    <WorkspacePresenceContext.Provider
      value={workspacePresenceValue}
    >
      <Outlet />
    </WorkspacePresenceContext.Provider>
  );
}
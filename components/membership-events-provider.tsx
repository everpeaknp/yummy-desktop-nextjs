"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useNotificationStore } from "@/hooks/use-notifications";
import {
  dispatchMembershipEvent,
  isMembershipEvent,
  type MembershipEventPayload,
} from "@/lib/restaurant-membership";

function wsBase() {
  const base = process.env.NEXT_PUBLIC_API_URL
    || "https://api.yummyever.com";
  return base.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://").replace(/\/+$/, "");
}

function showUnreadNotification(count: number) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const notification = new Notification("New Yummy notification", {
      body: `You have ${count} unread notification${count === 1 ? "" : "s"}.`,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: "yummy-unread",
    });
    window.setTimeout(() => notification.close(), 6000);
  } catch {
    // Some browsers expose Notification but do not support its constructor.
  }
}

/** One authenticated notification socket for both dashboard and onboarding users. */
export function MembershipEventsProvider() {
  const user = useAuth((state) => state.user);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let active = true;
    let reconnectTimer: number | undefined;
    let pingTimer: number | undefined;

    const connect = () => {
      if (!active) return;
      const token = localStorage.getItem("accessToken");
      if (!token) return;

      const params = new URLSearchParams({
        token,
        user_id: String(user.id),
      });
      if (user.restaurant_id) params.set("restaurant_id", String(user.restaurant_id));
      const role = user.primary_role || user.role || user.roles?.[0];
      if (role) params.set("role", role);

      const socket = new WebSocket(`${wsBase()}/ws/notifications?${params}`);
      socketRef.current = socket;
      socket.onopen = () => {
        if (pingTimer) window.clearInterval(pingTimer);
        pingTimer = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, 30_000);
      };
      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data) as {
            event?: unknown;
            payload?: MembershipEventPayload & { count?: number | string };
          };
          if (data.event === "notifications_unread" && data.payload) {
            const count = Number(data.payload.count || 0);
            const oldCount = useNotificationStore.getState().unreadCount;
            useNotificationStore.getState().setUnreadCount(count);
            if (count > oldCount && document.visibilityState === "hidden") {
              showUnreadNotification(count);
            }
            return;
          }
          if (isMembershipEvent(data.event)) {
            dispatchMembershipEvent({ event: data.event, payload: data.payload || {} });
          }
        } catch {
          // Ignore malformed/ping frames; the authenticated socket stays alive.
        }
      };
      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (pingTimer) window.clearInterval(pingTimer);
        if (active) reconnectTimer = window.setTimeout(connect, 5_000);
      };
      socket.onerror = () => socket.close();
    };

    connect();
    const reconnectWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      const socket = socketRef.current;
      if (!socket || socket.readyState === WebSocket.CLOSED) connect();
    };
    document.addEventListener("visibilitychange", reconnectWhenVisible);

    return () => {
      active = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (pingTimer) window.clearInterval(pingTimer);
      document.removeEventListener("visibilitychange", reconnectWhenVisible);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [user?.id, user?.primary_role, user?.restaurant_id, user?.role, user?.roles]);

  return null;
}

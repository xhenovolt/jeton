'use client';

/**
 * useChat Hook
 * Manages conversation and message state, handles API calls
 */

import { useEffect, useState, useCallback, useRef } from 'react';

// Polling intervals. Kept modest — Neon compute is auto-paused, and each
// hit re-warms it. The message pill takes precedence when a conversation
// is open; the sidebar refresh runs slower.
const MESSAGE_POLL_MS      = 4000;
const CONVERSATION_POLL_MS = 15000;

export function useChat() {
  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingConvs, setIsLoadingConvs] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  // Last message timestamp we've seen for the *currently open* conversation.
  // The polling loop uses this as the ?since= watermark so we only pull
  // new rows, not the whole thread.
  const lastMessageAtRef = useRef(null);
  // Throttle typing pings to at most one every 2s per open conversation.
  const lastTypingPingAtRef = useRef(0);

  const clearError = useCallback(() => setError(null), []);

  // ── Fetch conversations ──
  const fetchConversations = useCallback(async () => {
    setIsLoadingConvs(true);
    try {
      const res = await fetch('/api/communication/conversations?limit=50', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch conversations');
      const data = await res.json();
      setConversations(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingConvs(false);
    }
  }, []);

  // ── Fetch messages for selected conversation ──
  const fetchMessages = useCallback(async (convId) => {
    if (!convId) return;
    setIsLoadingMessages(true);
    try {
      const res = await fetch(
        `/api/communication/${convId}/messages?limit=50`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      const rows = data.data || [];
      setMessages(rows);
      lastMessageAtRef.current = rows.length > 0
        ? rows[rows.length - 1].created_at
        : data.serverTime || new Date().toISOString();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // ── Announce that I'm typing (throttled) ──
  const notifyTyping = useCallback(() => {
    if (!selectedConvId) return;
    const now = Date.now();
    if (now - lastTypingPingAtRef.current < 2000) return;
    lastTypingPingAtRef.current = now;
    fetch('/api/communication/typing', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: selectedConvId }),
    }).catch(() => {});
  }, [selectedConvId]);

  // ── Incremental poll: fetch only messages newer than what we have ──
  const pollNewMessages = useCallback(async (convId) => {
    if (!convId || !lastMessageAtRef.current) return;
    try {
      const since = encodeURIComponent(lastMessageAtRef.current);
      const res = await fetch(
        `/api/communication/${convId}/messages?since=${since}`,
        { credentials: 'include' }
      );
      if (!res.ok) return;
      const data = await res.json();
      const rows = data.data || [];
      if (rows.length === 0) return;
      setMessages((prev) => {
        // De-dupe by id — a locally-echoed optimistic send may already be present.
        const known = new Set(prev.map((m) => m.id));
        const additions = rows.filter((r) => !known.has(r.id));
        if (additions.length === 0) return prev;
        return [...prev, ...additions];
      });
      lastMessageAtRef.current = rows[rows.length - 1].created_at;
    } catch {
      // Silent — polling failures should not disturb the UI.
    }
  }, []);

  // ── Send message ──
  const sendMessage = useCallback(
    async (content, attachment = null) => {
      if (!selectedConvId) throw new Error('No conversation selected');

      try {
        // attachment.type is a MIME string (e.g. 'image/png'). The server
        // expects message_type to be the CATEGORY (image/video/audio/file)
        // and media_type to hold the MIME.
        const mime = attachment?.type || '';
        let category = 'text';
        if (attachment) {
          if      (mime.startsWith('image/')) category = 'image';
          else if (mime.startsWith('video/')) category = 'video';
          else if (mime.startsWith('audio/')) category = 'audio';
          else                                 category = 'file';
        }
        const res = await fetch(
          `/api/communication/${selectedConvId}/messages`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content,
              message_type: category,
              media_url:  attachment?.url  || null,
              media_type: mime || null,
              file_name:  attachment?.name || null,
              file_size:  attachment?.size || null,
            }),
          }
        );

        if (!res.ok) throw new Error('Failed to send message');
        const data = await res.json();

        // Add to local messages and advance the polling watermark so we
        // don't re-fetch our own echo.
        setMessages((prev) => [...prev, data.data]);
        if (data.data?.created_at) lastMessageAtRef.current = data.data.created_at;

        // Update last_message_at in conversations
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === selectedConvId
              ? { ...conv, last_message_at: new Date().toISOString() }
              : conv
          )
        );

        return data.data;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [selectedConvId]
  );

  // ── Create new conversation ──
  const createConversation = useCallback(async (type, name, memberIds) => {
    try {
      const res = await fetch('/api/communication/conversations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          name,
          participants: memberIds,
        }),
      });

      if (!res.ok) throw new Error('Failed to create conversation');
      const data = await res.json();

      // If existing, don't add duplicate
      if (!data.data.existing) {
        setConversations((prev) => [data.data, ...prev]);
      }

      setSelectedConvId(data.data.id);
      return data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Initial load + slow polling loop for the sidebar. Pauses when the tab
  // is hidden to avoid burning Neon compute for offscreen work.
  useEffect(() => {
    fetchConversations();
    let timer = null;
    const tick = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        fetchConversations();
      }
    };
    timer = setInterval(tick, CONVERSATION_POLL_MS);
    return () => clearInterval(timer);
  }, [fetchConversations]);

  // Fast polling loop for the OPEN conversation. Fires only when a
  // conversation is selected and pauses when the tab is hidden.
  useEffect(() => {
    if (!selectedConvId) return;
    let timer = null;
    const tick = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        pollNewMessages(selectedConvId);
        // Piggyback typing indicator refresh on the same cadence.
        fetch(`/api/communication/typing?conversationId=${selectedConvId}`, {
          credentials: 'include',
        })
          .then((r) => r.ok && r.json())
          .then((j) => {
            if (!j?.success) return;
            // Normalize to a string array of display names — the UI expects
            // "Alice is typing" strings, not { user_id, name } objects.
            setTypingUsers((j.typingUsers || []).map((t) => t.name || 'Someone'));
          })
          .catch(() => {});
      }
    };
    timer = setInterval(tick, MESSAGE_POLL_MS);
    return () => {
      clearInterval(timer);
      setTypingUsers([]);
    };
  }, [selectedConvId, pollNewMessages]);

  // Load messages when conversation selected + fire bulk mark-read so the
  // sidebar's unread dot clears on open (WhatsApp parity).
  useEffect(() => {
    if (!selectedConvId) return;
    fetchMessages(selectedConvId);
    fetch(`/api/communication/${selectedConvId}/read`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((res) => res.ok && res.json())
      .then((data) => {
        if (data?.success && data.marked_read > 0) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === selectedConvId ? { ...c, unread_count: 0 } : c
            )
          );
        }
      })
      .catch(() => {});
  }, [selectedConvId, fetchMessages]);

  return {
    // State
    conversations,
    selectedConvId,
    messages,
    isLoadingConvs,
    isLoadingMessages,
    error,
    typingUsers,

    // Actions
    setSelectedConvId,
    fetchConversations,
    fetchMessages,
    sendMessage,
    createConversation,
    clearError,
    notifyTyping,
  };
}

export default useChat;

'use client';

/**
 * Communication Module — WhatsApp + Google Meet Replacement
 * Full chat interface with staff-based user picker, file sharing, calls, real-time
 */

import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { useToast } from '@/components/ui/Toast';
import { ChatSidebar } from '@/components/communication/ChatSidebar';
import { ChatWindow } from '@/components/communication/ChatWindow';
import useChat from '@/hooks/useChat';
import { api, confirmAction } from '@/lib/api-client';
import { PageTransition } from '@/components/ui/PageTransition';

// Lazy load heavy modals — only loaded when user opens them
const NewConversationModal = lazy(() => import('@/components/communication/NewConversationModal').then(m => ({ default: m.NewConversationModal })));

export default function CommunicationPage() {
  const toast = useToast();
  const [showNewConvModal, setShowNewConvModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const chat = useChat();

  // Fetch current user ID
  useEffect(() => {
    api.get('/api/auth/me', { silent: true }).then(res => {
      if (res.ok && res.data) {
        setCurrentUserId(res.data.id || res.data.user?.id);
      }
    });
  }, []);

  // Show chat errors as toasts — clear error immediately to prevent re-fire
  useEffect(() => {
    if (chat.error) {
      toast.error(chat.error);
      chat.clearError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.error]);

  const handleCreateConversation = useCallback(
    async (type, name, memberIds) => {
      try {
        await chat.createConversation(type, name, memberIds);
        toast.success('Conversation created!');
      } catch (err) {
        toast.error(err.message || 'Failed to create conversation');
        throw err;
      }
    },
    [chat, toast]
  );

  const handleSendMessage = useCallback(
    async (content, attachment) => {
      try {
        await chat.sendMessage(content, attachment);
      } catch (err) {
        toast.error('Failed to send message');
      }
    },
    [chat, toast]
  );

  // Calls: the ledger + missed-call notifications work, but real audio/
  // video streaming needs a signaling server + TURN infrastructure that
  // isn't wired up yet. Rather than pretend to connect, tell the user
  // honestly and log the intent so we can measure interest.
  const handleStartCall = useCallback((type) => {
    if (!chat.selectedConvId) return;
    toast.info(
      `${type === 'video' ? 'Video' : 'Voice'} calls are coming soon — the streaming layer isn't wired up yet.`
    );
  }, [chat.selectedConvId, toast]);

  // Get selected conversation name
  const selectedConv = chat.conversations.find(c => c.id === chat.selectedConvId);

  // Archive/unarchive handler (per-user, WhatsApp-parity)
  const handleArchive = useCallback(async (convId) => {
    const conv = chat.conversations.find(c => c.id === convId);
    const archiving = !(conv?.is_archived_for_me ?? conv?.is_archived);
    const confirmed = await confirmAction(
      archiving ? 'Archive Conversation?' : 'Unarchive Conversation?',
      archiving ? 'This will hide the conversation from your main list.' : 'This will move the conversation back to your main list.',
      archiving ? 'Archive' : 'Unarchive',
      'question'
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/communication/conversations/${convId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: archiving }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(data.message || (archiving ? 'Conversation archived' : 'Conversation unarchived'));
      chat.fetchConversations();
    } catch (err) {
      toast.error(err.message || 'Failed to update conversation');
    }
  }, [chat, toast]);

  // Delete handler
  const handleDelete = useCallback(async (convId) => {
    const confirmed = await confirmAction(
      'Delete Conversation?',
      'This action cannot be undone. All messages will be hidden.',
      'Delete',
      'warning'
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/communication/conversations/${convId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Conversation deleted');
      if (chat.selectedConvId === convId) chat.setSelectedConvId(null);
      chat.fetchConversations();
    } catch (err) {
      toast.error(err.message || 'Failed to delete conversation');
    }
  }, [chat, toast]);

  // Filter conversations based on archived state (per-user flag).
  const visibleConversations = chat.conversations.filter(c => {
    const archived = c.is_archived_for_me ?? c.is_archived;
    return showArchived ? archived : !archived;
  });

  return (
    <PageTransition className="h-screen">
      <div className="flex h-full bg-background">
        {/* Sidebar */}
        <div className="w-80 border-r border-border flex-shrink-0 hidden md:flex flex-col">
          <ChatSidebar
            conversations={visibleConversations}
            selectedConversationId={chat.selectedConvId}
            onSelectConversation={chat.setSelectedConvId}
            onCreateNew={() => setShowNewConvModal(true)}
            onArchive={handleArchive}
            onDelete={handleDelete}
            showArchived={showArchived}
            onToggleArchived={() => setShowArchived(prev => !prev)}
            isLoadingConvs={chat.isLoadingConvs}
          />
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <ChatWindow
            conversationId={chat.selectedConvId}
            conversationName={selectedConv?.display_name || selectedConv?.name || selectedConv?.other_participant_name || selectedConv?.last_sender_name}
            messages={chat.messages}
            currentUserId={currentUserId}
            isLoading={chat.isLoadingMessages}
            onSendMessage={handleSendMessage}
            onLoadMore={() => {}}
            onStartCall={handleStartCall}
            typingUsers={chat.typingUsers}
            onInputChange={chat.notifyTyping}
          />
        </div>

        {/* New Conversation Modal */}
        <Suspense fallback={null}>
          <NewConversationModal
            isOpen={showNewConvModal}
            onClose={() => setShowNewConvModal(false)}
            onCreateConversation={handleCreateConversation}
          />
        </Suspense>

      </div>
    </PageTransition>
  );
}

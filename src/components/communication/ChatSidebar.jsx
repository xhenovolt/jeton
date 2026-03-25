'use client';

/**
 * Chat Sidebar Component
 * Lists conversations with unread badges, search, and new chat button
 */

import { useEffect, useState, useRef } from 'react';
import { Plus, Search, X, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function ChatSidebar({
  conversations = [],
  selectedConversationId,
  onSelectConversation,
  onCreateNew,
  isLoadingConvs = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredConvs, setFilteredConvs] = useState(conversations);

  useEffect(() => {
    const filtered = conversations.filter(
      (conv) =>
        (conv.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (conv.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredConvs(filtered);
  }, [conversations, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-foreground">Messages</h2>
          <button
            onClick={onCreateNew}
            className="p-2 hover:bg-muted rounded-lg transition text-primary"
            title="New conversation"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-muted text-foreground text-sm rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingConvs ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Loading conversations...
          </div>
        ) : filteredConvs.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            {conversations.length === 0
              ? 'No conversations yet. Start one!'
              : 'No conversations match your search'}
          </div>
        ) : (
          <AnimatePresence>
            {filteredConvs.map((conv) => (
              <motion.button
                key={conv.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full px-4 py-3 border-b border-border text-left hover:bg-muted/50 transition ${
                  selectedConversationId === conv.id ? 'bg-muted' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Conversation Name */}
                    <h3 className="font-medium text-foreground text-sm truncate">
                      {conv.name || 'Direct Message'}
                    </h3>

                    {/* Last Message Preview */}
                    {conv.last_message_at && (
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {new Date(conv.last_message_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Unread Badge */}
                  {conv.unread_count > 0 && (
                    <div className="flex shrink-0 items-center justify-center w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs font-bold">
                      {conv.unread_count > 99 ? '99+' : conv.unread_count}
                    </div>
                  )}
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

export default ChatSidebar;

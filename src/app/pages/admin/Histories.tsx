'use client';

import { useState, useEffect } from 'react';
import {
  ClockCounterClockwiseIcon,
  TrashIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ChatCircleIcon,
  UserIcon,
} from '@phosphor-icons/react';

type GenerationHistory = {
  id: string;
  userId: string;
  prompt: string;
  config: string | null;
  messages: string | null;
  logoVersionIds: string | null;
  createdAt: string;
  updatedAt: string;
  userEmail?: string;
  userName?: string;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string | { type: string; text?: string }[];
};

export function AdminHistories() {
  const [histories, setHistories] = useState<GenerationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedHistory, setSelectedHistory] =
    useState<GenerationHistory | null>(null);
  const limit = 20;

  useEffect(() => {
    fetchHistories();
  }, [page]);

  const fetchHistories = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/histories?limit=${limit}&offset=${page * limit}`
      );
      const data = (await response.json()) as {
        histories?: GenerationHistory[];
        total?: number;
      };
      setHistories(data.histories || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch histories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this generation history?'))
      return;

    try {
      await fetch(`/api/admin/histories/${id}`, { method: 'DELETE' });
      setHistories(histories.filter((h) => h.id !== id));
      setTotal(total - 1);
      if (selectedHistory?.id === id) {
        setSelectedHistory(null);
      }
    } catch (error) {
      console.error('Failed to delete history:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const parseMessages = (messagesJson: string | null): ChatMessage[] => {
    if (!messagesJson) return [];
    try {
      return JSON.parse(messagesJson) as ChatMessage[];
    } catch {
      return [];
    }
  };

  const getMessageContent = (message: ChatMessage): string => {
    if (typeof message.content === 'string') {
      return message.content;
    }
    const textPart = message.content.find(
      (p: { type: string; text?: string }) => p.type === 'text'
    );
    return textPart?.text || '';
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Generation History</h1>
        <p className="text-muted-foreground mt-2">
          View past logo generation conversations and their results.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Loading histories...</p>
        </div>
      ) : histories.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* History List */}
          <div className="lg:col-span-1 space-y-2">
            {histories.map((history) => (
              <div
                key={history.id}
                onClick={() => setSelectedHistory(history)}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  selectedHistory?.id === history.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{history.prompt}</p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <UserIcon className="w-3 h-3" />
                      <span className="truncate">
                        {history.userName || history.userEmail || 'Unknown'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(history.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(history.id);
                    }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Delete"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-input hover:bg-accent disabled:opacity-50 transition-colors text-sm"
                >
                  <CaretLeftIcon className="w-4 h-4" />
                  Previous
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages - 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-input hover:bg-accent disabled:opacity-50 transition-colors text-sm"
                >
                  Next
                  <CaretRightIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* History Detail */}
          <div className="lg:col-span-2">
            {selectedHistory ? (
              <div className="rounded-lg border border-border p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">
                    {selectedHistory.prompt}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Created {formatDate(selectedHistory.createdAt)} by{' '}
                    {selectedHistory.userName ||
                      selectedHistory.userEmail ||
                      'Unknown'}
                  </p>
                </div>

                {selectedHistory.config && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Configuration</h3>
                    <pre className="p-4 rounded-md bg-muted text-sm overflow-x-auto">
                      {JSON.stringify(
                        JSON.parse(selectedHistory.config),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium mb-2">
                    Conversation ({parseMessages(selectedHistory.messages).length}{' '}
                    messages)
                  </h3>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {parseMessages(selectedHistory.messages).map(
                      (message, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-md ${
                            message.role === 'user'
                              ? 'bg-primary/10 ml-8'
                              : 'bg-muted mr-8'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <ChatCircleIcon className="w-3 h-3" />
                            <span className="text-xs font-medium capitalize">
                              {message.role}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">
                            {getMessageContent(message)}
                          </p>
                        </div>
                      )
                    )}
                    {parseMessages(selectedHistory.messages).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No messages recorded
                      </p>
                    )}
                  </div>
                </div>

                {selectedHistory.logoVersionIds && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">
                      Generated Logos
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(
                        JSON.parse(selectedHistory.logoVersionIds) as string[]
                      ).map((versionId) => (
                        <span
                          key={versionId}
                          className="px-2 py-1 rounded-md bg-muted text-xs font-mono"
                        >
                          {versionId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center min-h-[400px] rounded-lg border border-dashed border-border">
                <div className="text-center">
                  <ClockCounterClockwiseIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Select a history entry to view details
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-[400px] rounded-lg border border-dashed border-border">
          <div className="text-center">
            <ClockCounterClockwiseIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Generation history will appear here once conversations are stored.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

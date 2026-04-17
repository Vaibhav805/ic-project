'use client';

import { FormEvent, useMemo, useState, useEffect, ReactNode, ChangeEvent } from 'react';

type StoredMessage = {
  id: number;
  user: string;
  text: string;
  timestamp: number;
  recipient?: string;
};

type ChatMessage = {
  id: number;
  user: string;
  text: string;
  status: 'pending' | 'delivered' | 'error';
  isMe: boolean;
  timestamp: number;
  recipient?: string;
};

const users: string[] = ['A', 'B', 'C', 'D'];

export default function Home(): ReactNode {
  const [activeUser, setActiveUser] = useState<string>('A');
  const [message, setMessage] = useState<string>('');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState<boolean>(false);
  const [lastMessageId, setLastMessageId] = useState<number>(-1);
  const [messageType, setMessageType] = useState<'broadcast' | 'personal'>('broadcast');
  const [selectedRecipient, setSelectedRecipient] = useState<string>('B');

  const userList = useMemo<string[]>(() => users, []);

  // Update recipient when active user changes
  useEffect(() => {
    const filteredUsers = userList.filter((u) => u !== activeUser);
    if (filteredUsers.length > 0) {
      setSelectedRecipient(filteredUsers[0]);
    }
  }, [activeUser, userList]);

  // Clear messages on page load
  useEffect(() => {
    const clearOnLoad = async (): Promise<void> => {
      try {
        await fetch('/api/messages', { method: 'DELETE' });
        setChat([]);
        setLastMessageId(-1);
      } catch (err) {
        console.error('Failed to clear messages', err);
      }
    };
    clearOnLoad();
  }, []);

  useEffect(() => {
    const fetchMessages = async (): Promise<void> => {
      try {
        const res = await fetch(`/api/messages?lastId=${lastMessageId}&user=${activeUser}`);
        if (!res.ok) return;

        const data = (await res.json()) as { messages: StoredMessage[] };
        if (data.messages && data.messages.length > 0) {
          const converted: ChatMessage[] = data.messages.map((msg: StoredMessage) => ({
            id: msg.id,
            user: msg.user,
            text: msg.text,
            status: 'delivered' as const,
            isMe: msg.user === activeUser,
            timestamp: msg.timestamp,
            recipient: msg.recipient,
          }));

          setChat((prev: ChatMessage[]) => {
            const existingIds = new Set(prev.map((m: ChatMessage) => m.id));
            const newMessages: ChatMessage[] = converted.filter((m: ChatMessage) => !existingIds.has(m.id));
            return [...prev, ...newMessages];
          });

          setLastMessageId(data.messages[data.messages.length - 1].id);
        }
      } catch (err) {
        console.error('Fetch messages error', err);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 600);
    return (): void => {
      clearInterval(interval);
    };
  }, [lastMessageId, activeUser]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    const trimmed = message.trim();
    if (!trimmed) return;

    const tempId = Date.now();
    const recipientForMessage = messageType === 'personal' ? selectedRecipient : undefined;
    const pendingMessage: ChatMessage = {
      id: tempId,
      user: activeUser,
      text: trimmed,
      status: 'pending',
      isMe: true,
      timestamp: Date.now(),
      recipient: recipientForMessage,
    };

    setChat((prev: ChatMessage[]) => [...prev, pendingMessage]);
    setSending(true);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: activeUser,
          message: trimmed,
          recipient: messageType === 'personal' ? selectedRecipient : undefined,
        }),
      });

      if (!res.ok) throw new Error('Bad response');

      const result = (await res.json()) as { message: StoredMessage };
      setChat((prev: ChatMessage[]) =>
        prev.map((m: ChatMessage) =>
          m.id === tempId ? { ...m, status: 'delivered' as const, id: result.message.id } : m,
        ),
      );

      setLastMessageId((prev: number) => Math.max(prev, result.message.id));
    } catch (err) {
      console.error('Send message error', err);
      setChat((prev: ChatMessage[]) =>
        prev.map((m: ChatMessage) =>
          m.id === tempId ? { ...m, status: 'error' as const } : m,
        ),
      );
    } finally {
      setMessage('');
      setSending(false);
    }
  };

  const formatStatus = (status: ChatMessage['status']) => {
    if (status === 'pending') return '⏳';
    if (status === 'delivered') return '✓✓';
    if (status === 'error') return '❌';
    return '';
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto flex h-[90vh] max-w-6xl overflow-hidden rounded-lg border bg-white shadow-lg">
        <aside className="w-60 border-r bg-slate-50 p-4">
          <h2 className="mb-4 text-xl font-bold">👥 Users</h2>
          <ul className="space-y-2">
            {userList.map((u) => (
              <li
                key={u}
                className={`cursor-pointer rounded-lg px-3 py-2 ${
                  activeUser === u ? 'bg-blue-500 text-white' : 'bg-white text-slate-700'
                } shadow-sm`}
                onClick={() => setActiveUser(u)}
              >
                User {u}
                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-green-500" title="Online" />
              </li>
            ))}
          </ul>
        </aside>

        <main className="flex flex-1 flex-col p-4">
          <header className="mb-3 flex items-center justify-between border-b pb-3">
            <div>
              <h1 className="text-2xl font-bold">💬 Chat as User {activeUser}</h1>
              <p className="text-sm text-slate-500">Connected to backend at localhost:3000 (Node + Next.js + C TCP bridge)</p>
            </div>
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">🟢 OK</span>
          </header>

          <div className="mb-3 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            <label className="font-semibold text-slate-700">📤 Message Type:</label>
            <select
              value={messageType}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setMessageType(e.target.value as 'broadcast' | 'personal')}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-sm font-medium"
            >
              <option value="broadcast">Broadcast (Everyone)</option>
              <option value="personal">Personal Message</option>
            </select>
            {messageType === 'personal' && (
              <>
                <label className="font-semibold text-slate-700">👤 Send to:</label>
                <select
                  value={selectedRecipient}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedRecipient(e.target.value)}
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-sm font-medium"
                >
                  {userList
                    .filter((u) => u !== activeUser)
                    .map((u) => (
                      <option key={u} value={u}>
                        User {u}
                      </option>
                    ))}
                </select>
              </>
            )}
          </div>

          <section className="mb-3 flex-1 overflow-y-auto p-2" style={{ minHeight: '0' }}>
            {chat.length === 0 ? (
              <div className="text-center text-slate-400">No messages yet. Start typing below.</div>
            ) : (
              <div className="space-y-2">
                {chat
                  .filter(
                    (msg) =>
                      !msg.recipient || // Show broadcast messages
                      msg.user === activeUser || // Show messages sent by me
                      msg.recipient === activeUser // Show messages sent to me
                  )
                  .map((msg) => (
                  <div
                    key={`msg-${msg.id}-${msg.recipient || 'broadcast'}`}
                    className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`mb-1 text-xs font-bold ${
                      msg.recipient
                        ? msg.isMe
                          ? 'text-purple-700'
                          : 'text-purple-600'
                        : msg.isMe
                          ? 'text-blue-600'
                          : 'text-slate-600'
                    }`}>
                      {msg.user === activeUser ? 'You' : `User ${msg.user}`}
                      {msg.recipient && ` 🔒 to User ${msg.recipient}`}
                    </div>
                    <div
                      className={`max-w-[70%] rounded-xl border p-3 ${
                        msg.recipient
                          ? msg.isMe
                            ? 'bg-purple-500 text-white'
                            : 'bg-purple-100 text-slate-900'
                          : msg.isMe
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-slate-900'
                      }`}
                    >
                      <div className="break-words text-sm">{msg.text}</div>
                      <div className="mt-1 text-right text-xs opacity-70">{formatStatus(msg.status)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 rounded-lg border px-3 py-2 font-semibold outline-none placeholder:font-bold focus:border-blue-500"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </form>
        </main>
      </div>

      <div className="mt-3 text-center text-sm text-slate-600">
        <p className="font-semibold">💡 Tips:</p>
        <p>Open multiple tabs and switch users to see messages sync in real-time. Use Personal Messages for private chats!</p>
      </div>
    </div>
  );
}

'use client';

import { FormEvent, useState, useEffect, ChangeEvent } from 'react';

type StoredMessage = {
  id: number;
  user: string;
  text: string;
  timestamp: number;
  recipient?: string;
};

// UI message with extra display fields
type ChatMessage = {
  id: number;
  user: string;
  text: string;
  status: 'pending' | 'delivered' | 'error';
  isMe: boolean;
  timestamp: number;
  recipient?: string;
};

// demo users
const users = ['A', 'B', 'C', 'D'];

export default function Home() {
  const [activeUser, setActiveUser] = useState('A');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [lastId, setLastId] = useState(-1);
  
  const [chatMode, setChatMode] = useState<'broadcast' | 'personal'>('broadcast');
  const [targetUser, setTargetUser] = useState('B');

  // reset target when switching accounts
  useEffect(() => {
    let others = users.filter(u => u !== activeUser);
    if (others.length > 0) {
      setTargetUser(others[0]);
    }
  }, [activeUser]);

  // clear db on mount so we start fresh
  useEffect(() => {
    const clearDb = async () => {
      try {
        await fetch('/api/messages', { method: 'DELETE' });
        setMessages([]);
        setLastId(-1);
      } catch (err) {
        console.error('uh oh, failed to clean db:', err);
      }
    };
    clearDb();
  }, []);

  // TODO: switch to websockets eventually
  useEffect(() => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/messages?lastId=${lastId}&user=${activeUser}`);
        if (!response.ok) return;

        const data = (await response.json()) as { messages: StoredMessage[] };
        
        if (data.messages && data.messages.length > 0) {
          let newMsgs: ChatMessage[] = data.messages.map(m => ({
            id: m.id,
            user: m.user,
            text: m.text,
            status: 'delivered',
            isMe: m.user === activeUser,
            timestamp: m.timestamp,
            recipient: m.recipient,
          }));

          setMessages(prev => {
            const seenIds = new Set(prev.map(m => m.id));
            const fresh = newMsgs.filter(m => !seenIds.has(m.id));
            return [...prev, ...fresh];
          });

          setLastId(data.messages[data.messages.length - 1].id);
        }
      } catch (err) {
        console.error('error pulling chats', err);
      }
    };

    poll();
    const timer = setInterval(poll, 600);
    
    return () => clearInterval(timer);
  }, [lastId, activeUser]);

  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const text = input.trim();
    if (!text) return;

    const tempId = Date.now();
    const sendTo = chatMode === 'personal' ? targetUser : undefined;
    
    const msg: ChatMessage = {
      id: tempId,
      user: activeUser,
      text,
      status: 'pending',
      isMe: true,
      timestamp: Date.now(),
      recipient: sendTo,
    };

    setMessages(prev => [...prev, msg]);
    setIsSending(true);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: activeUser,
          message: text,
          recipient: sendTo,
        }),
      });

      if (!res.ok) throw new Error('server gave bad response');

      const result = (await res.json()) as { message: StoredMessage };
      
      setMessages(prev =>
        prev.map(m =>
          m.id === tempId ? { ...m, status: 'delivered', id: result.message.id } : m,
        ),
      );

      setLastId(prev => Math.max(prev, result.message.id));
    } catch (e) {
      console.error('could not send msg:', e);
      setMessages(prev =>
        prev.map(m =>
          m.id === tempId ? { ...m, status: 'error' } : m,
        ),
      );
    } finally {
      setInput('');
      setIsSending(false);
    }
  };

  const statusLabel = (s: ChatMessage['status']) => {
    if (s === 'pending') return 'Sending...';
    if (s === 'delivered') return 'Delivered';
    if (s === 'error') return 'Failed to send';
    return '';
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 font-sans text-gray-900 sm:p-6 lg:p-8">
      <div className="flex h-[85vh] w-full max-w-[1000px] flex-row overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-gray-200">

        {/* sidebar */}
        <aside className="flex w-20 flex-col border-r border-gray-100 bg-gray-50/80 sm:w-64">
          <div className="flex items-center border-b border-gray-100 p-4 sm:p-6">
            <div className="hidden flex-1 sm:block">
              <h2 className="text-lg font-semibold tracking-tight text-gray-900">Accounts</h2>
              <p className="text-xs text-gray-500">Pick a user</p>
            </div>
            <div className="mx-auto block sm:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 font-bold text-white">
                {activeUser}
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
            {users.map(u => (
              <button
                key={u}
                onClick={() => setActiveUser(u)}
                className={`group flex w-full items-center gap-3 rounded-2xl p-2.5 transition-all duration-200 sm:px-4 sm:py-3 pb-3 ${activeUser === u
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-gray-200'
                    : 'text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm hover:ring-1 hover:ring-gray-200'
                  }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all ${activeUser === u
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200/50'
                      : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                    }`}
                >
                  {u}
                </div>
                <div className="hidden text-left sm:block">
                  <div className="text-sm font-medium">User {u}</div>
                  <div className="text-xs opacity-75 mt-0.5">
                    {activeUser === u ? 'Active Now' : 'Switch account'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* chat area */}
        <main className="flex flex-1 flex-col bg-white">
          <header className="flex flex-col items-start justify-between gap-4 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-base font-bold text-blue-600 ring-1 ring-blue-100 sm:h-12 sm:w-12 sm:text-lg">
                {activeUser}
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 sm:text-lg">Chat</h1>
                <p className="flex items-center text-[11px] font-medium text-green-600 sm:text-xs">
                  <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-green-500"></span> Online
                </p>
              </div>
            </div>

            <div className="flex w-full items-center gap-2 rounded-full bg-gray-50 px-2 py-1.5 ring-1 ring-gray-200 sm:w-auto">
              <span className="pl-3 text-[13px] font-semibold text-gray-500">To:</span>
              <select
                value={chatMode === 'broadcast' ? 'broadcast' : targetUser}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  if (e.target.value === 'broadcast') {
                    setChatMode('broadcast');
                  } else {
                    setChatMode('personal');
                    setTargetUser(e.target.value);
                  }
                }}
                className="w-full cursor-pointer appearance-none rounded-full border-none bg-transparent py-1.5 pl-2 pr-8 text-[13px] font-semibold text-gray-800 focus:outline-none focus:ring-0 sm:w-auto sm:text-sm"
                style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%22%200%22%2020%22%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.25em 1.25em' }}
              >
                <option value="broadcast">Everyone (Broadcast)</option>
                {users
                  .filter(u => u !== activeUser)
                  .map(u => (
                    <option key={u} value={u}>
                      User {u} (Direct)
                    </option>
                  ))}
              </select>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4 sm:p-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-sm ring-1 ring-gray-100">
                  💬
                </div>
                <h3 className="text-base font-semibold text-gray-900 sm:text-lg">No messages yet</h3>
                <p className="mt-1 text-[13px] text-gray-500 sm:text-sm">Say hello to start the conversation.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5 sm:gap-6">
                {messages
                  .filter(
                    (msg) =>
                      !msg.recipient ||
                      msg.user === activeUser ||
                      msg.recipient === activeUser
                  )
                  .map((msg) => (
                    <div
                      key={`msg-${msg.id}-${msg.recipient || 'broadcast'}`}
                      className={`flex w-full ${msg.isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex max-w-[85%] flex-col sm:max-w-[70%] ${msg.isMe ? 'items-end' : 'items-start'}`}>
                        <div className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-semibold text-gray-500 sm:text-xs">
                          <span>{msg.user === activeUser ? 'You' : `User ${msg.user}`}</span>
                          {msg.recipient ? (
                            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-rose-600 ring-1 ring-inset ring-rose-200 sm:text-[10px]">
                              Private
                            </span>
                          ) : (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-gray-500 ring-1 ring-inset ring-gray-200 sm:text-[10px]">
                              Broadcast
                            </span>
                          )}
                        </div>

                        <div
                          className={`relative rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed shadow-sm sm:rounded-3xl sm:px-5 sm:py-3 sm:text-[15px] ${msg.isMe
                              ? 'bg-blue-600 text-white rounded-br-sm sm:rounded-br-md shadow-blue-600/10'
                              : 'bg-white text-gray-800 ring-1 ring-gray-200/60 rounded-bl-sm sm:rounded-bl-md shadow-gray-200/20'
                            }`}
                        >
                          {msg.text}
                        </div>

                        {msg.isMe && (
                          <div className="mt-1 px-2 text-[10px] font-medium text-gray-400 sm:mt-1.5 sm:text-[11px]">
                            {statusLabel(msg.status)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 bg-white p-3 sm:p-5">
            <form onSubmit={handleSend} className="flex items-end gap-2 sm:gap-3">
              <div className="flex-1 overflow-hidden rounded-3xl bg-gray-50 ring-1 ring-gray-200 transition-shadow focus-within:ring-2 focus-within:ring-blue-500">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  disabled={isSending}
                  className="max-h-32 min-h-[44px] w-full resize-none border-none bg-transparent px-4 py-3 text-[14px] font-medium outline-none placeholder:text-gray-400 disabled:opacity-50 sm:min-h-[48px] sm:text-[15px]"
                />
              </div>
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow disabled:pointer-events-none disabled:opacity-40 sm:h-12 sm:w-12"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="mr-0.5 h-5 w-5 sm:h-5 sm:w-5"
                >
                  <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                </svg>
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

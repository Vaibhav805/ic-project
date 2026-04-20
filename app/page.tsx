'use client';

import { useState, useEffect } from 'react';

type StoredMessage = { id: number; user: string; text: string; timestamp: number; recipient?: string };
type ChatMessage = StoredMessage & { status: 'pending' | 'delivered' | 'error'; isMe: boolean };

const USERS = ['A', 'B', 'C', 'D'];

export default function Home() {
  const [activeUser, setActiveUser] = useState('A');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [lastId, setLastId] = useState(-1);
  const [chatMode, setChatMode] = useState<'broadcast' | 'personal'>('broadcast');
  const [targetUser, setTargetUser] = useState('B');

  // when you switch user, pick a different default target
  useEffect(() => {
    let others = USERS.filter(u => u !== activeUser);
    if (others.length) setTargetUser(others[0]);
  }, [activeUser]);

  // wipe everything on load
  useEffect(() => {
    fetch('/api/messages', { method: 'DELETE' }).then(() => {
      setMessages([]);
      setLastId(-1);
    }).catch(console.error);
  }, []);

  // polling lol, should probably use websockets
  useEffect(() => {
    const poll = async () => {
      try {
        let r = await fetch(`/api/messages?lastId=${lastId}&user=${activeUser}`);
        if (!r.ok) return;
        let data = await r.json();
        let msgs = data.messages as StoredMessage[];
        if (!msgs || !msgs.length) return;

        let mapped: ChatMessage[] = msgs.map(m => ({
          ...m, status: 'delivered' as const, isMe: m.user === activeUser,
        }));
        setMessages(prev => {
          let ids = new Set(prev.map(m => m.id));
          return [...prev, ...mapped.filter(m => !ids.has(m.id))];
        });
        setLastId(msgs[msgs.length - 1].id);
      } catch (e) {
        console.error(e);
      }
    };
    poll();
    let interval = setInterval(poll, 600);
    return () => clearInterval(interval);
  }, [lastId, activeUser]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    let text = input.trim();
    if (!text) return;

    let id = Date.now();
    let to = chatMode === 'personal' ? targetUser : undefined;

    setMessages(prev => [...prev, {
      id, user: activeUser, text, status: 'pending',
      isMe: true, timestamp: Date.now(), recipient: to,
    }]);
    setSending(true);

    try {
      let res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: activeUser, message: text, recipient: to }),
      });
      if (!res.ok) throw new Error('nope');
      let result = await res.json();
      let saved = result.message;
      setMessages(prev => prev.map(m =>
        m.id === id ? { ...m, status: 'delivered' as const, id: saved.id } : m
      ));
      setLastId(prev => Math.max(prev, saved.id));
    } catch (e) {
      setMessages(prev => prev.map(m =>
        m.id === id ? { ...m, status: 'error' as const } : m
      ));
    } finally {
      setInput('');
      setSending(false);
    }
  }

  let visible = messages.filter(m =>
    !m.recipient || m.user === activeUser || m.recipient === activeUser
  );

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
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 font-bold text-white">{activeUser}</div>
            </div>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
            {USERS.map(u => (
              <button key={u} onClick={() => setActiveUser(u)}
                className={`group flex w-full items-center gap-3 rounded-2xl p-2.5 transition-all duration-200 sm:px-4 sm:py-3 pb-3 ${
                  activeUser === u ? 'bg-white text-blue-700 shadow-sm ring-1 ring-gray-200'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm hover:ring-1 hover:ring-gray-200'}`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                  activeUser === u ? 'bg-blue-600 text-white shadow-md shadow-blue-200/50'
                  : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'}`}>
                  {u}
                </div>
                <div className="hidden text-left sm:block">
                  <div className="text-sm font-medium">User {u}</div>
                  <div className="text-xs opacity-75 mt-0.5">{activeUser === u ? 'Active Now' : 'Switch account'}</div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex flex-1 flex-col bg-white">
          <header className="flex flex-col items-start justify-between gap-4 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-base font-bold text-blue-600 ring-1 ring-blue-100 sm:h-12 sm:w-12 sm:text-lg">{activeUser}</div>
              <div>
                <h1 className="text-base font-bold text-gray-900 sm:text-lg">Chat</h1>
                <p className="flex items-center text-[11px] font-medium text-green-600 sm:text-xs">
                  <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-green-500"></span> Online
                </p>
              </div>
            </div>
            <div className="flex w-full items-center gap-2 rounded-full bg-gray-50 px-2 py-1.5 ring-1 ring-gray-200 sm:w-auto">
              <span className="pl-3 text-[13px] font-semibold text-gray-500">To:</span>
              <select value={chatMode === 'broadcast' ? 'broadcast' : targetUser}
                onChange={e => {
                  if (e.target.value === 'broadcast') setChatMode('broadcast');
                  else { setChatMode('personal'); setTargetUser(e.target.value); }
                }}
                className="w-full cursor-pointer appearance-none rounded-full border-none bg-transparent py-1.5 pl-2 pr-8 text-[13px] font-semibold text-gray-800 focus:outline-none focus:ring-0 sm:w-auto sm:text-sm"
                style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%22%200%22%2020%22%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.25em 1.25em' }}>
                <option value="broadcast">Everyone (Broadcast)</option>
                {USERS.filter(u => u !== activeUser).map(u => (
                  <option key={u} value={u}>User {u} (Direct)</option>
                ))}
              </select>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4 sm:p-6">
            {visible.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-sm ring-1 ring-gray-100">💬</div>
                <h3 className="text-base font-semibold text-gray-900 sm:text-lg">No messages yet</h3>
                <p className="mt-1 text-[13px] text-gray-500 sm:text-sm">Say hello to start the conversation.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5 sm:gap-6">
                {visible.map(msg => (
                  <div key={`${msg.id}-${msg.recipient || 'all'}`}
                    className={`flex w-full ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex max-w-[85%] flex-col sm:max-w-[70%] ${msg.isMe ? 'items-end' : 'items-start'}`}>
                      <div className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-semibold text-gray-500 sm:text-xs">
                        <span>{msg.isMe ? 'You' : `User ${msg.user}`}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider ring-1 ring-inset sm:text-[10px] ${
                          msg.recipient ? 'bg-rose-50 text-rose-600 ring-rose-200' : 'bg-gray-100 text-gray-500 ring-gray-200'}`}>
                          {msg.recipient ? 'Private' : 'Broadcast'}
                        </span>
                      </div>
                      <div className={`relative rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed shadow-sm sm:rounded-3xl sm:px-5 sm:py-3 sm:text-[15px] ${
                        msg.isMe ? 'bg-blue-600 text-white rounded-br-sm sm:rounded-br-md shadow-blue-600/10'
                        : 'bg-white text-gray-800 ring-1 ring-gray-200/60 rounded-bl-sm sm:rounded-bl-md shadow-gray-200/20'}`}>
                        {msg.text}
                      </div>
                      {msg.isMe && <div className="mt-1 px-2 text-[10px] font-medium text-gray-400 sm:mt-1.5 sm:text-[11px]">
                        {msg.status === 'pending' ? 'Sending...' : msg.status === 'error' ? 'Failed' : 'Delivered'}
                      </div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 bg-white p-3 sm:p-5">
            <form onSubmit={handleSend} className="flex items-end gap-2 sm:gap-3">
              <div className="flex-1 overflow-hidden rounded-3xl bg-gray-50 ring-1 ring-gray-200 transition-shadow focus-within:ring-2 focus-within:ring-blue-500">
                <input value={input} onChange={e => setInput(e.target.value)}
                  placeholder="Type a message..." disabled={sending}
                  className="max-h-32 min-h-[44px] w-full resize-none border-none bg-transparent px-4 py-3 text-[14px] font-medium outline-none placeholder:text-gray-400 disabled:opacity-50 sm:min-h-[48px] sm:text-[15px]" />
              </div>
              <button type="submit" disabled={sending || !input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow disabled:pointer-events-none disabled:opacity-40 sm:h-12 sm:w-12">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="mr-0.5 h-5 w-5">
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

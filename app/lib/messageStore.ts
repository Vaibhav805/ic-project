// In-memory message store shared across all browser clients
type Message = {
  id: number;
  user: string;
  text: string;
  timestamp: number;
  recipient?: string; // undefined = broadcast, defined = personal message
};

let messages: Message[] = [];
let messageId = 0;

export function addMessage(user: string, text: string, recipient?: string): Message {
  const msg: Message = {
    id: messageId++,
    user,
    text,
    timestamp: Date.now(),
    recipient,
  };
  messages.push(msg);
  // Keep only last 100 messages to avoid memory bloat
  if (messages.length > 100) {
    messages = messages.slice(-100);
  }
  return msg;
}

export function getMessages(afterId: number = -1, currentUser?: string): Message[] {
  let filtered = afterId === -1 ? [...messages] : messages.filter((m) => m.id > afterId);
  
  // If currentUser is provided, filter based on visibility rules
  if (currentUser) {
    filtered = filtered.filter(
      (m) =>
        !m.recipient || // Show all broadcast messages
        m.user === currentUser || // Show messages sent by current user
        m.recipient === currentUser // Show messages sent to current user
    );
  }
  
  return filtered;
}

export function getAllMessages(): Message[] {
  return [...messages];
}

export function clearMessages(): void {
  messages = [];
  messageId = 0;
}

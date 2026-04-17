import { NextRequest, NextResponse } from 'next/server';
import { addMessage, getMessages, clearMessages } from '@/app/lib/messageStore';

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    clearMessages();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to clear messages' }, { status: 400 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const lastId = parseInt(searchParams.get('lastId') || '-1', 10);
    const currentUser = searchParams.get('user');

    const messages = getMessages(lastId, currentUser || undefined);
    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 400 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { message, user, recipient } = await request.json();

    if (!message || !user) {
      return NextResponse.json({ error: 'Message and user required' }, { status: 400 });
    }

    // Store message in shared store (recipient is optional, undefined = broadcast)
    const storedMsg = addMessage(user, message, recipient);

    // Also send to C TCP server for console clients
    const { createConnection } = await import('net');
    const client = createConnection({ host: 'localhost', port: 3001 });

    return new Promise<NextResponse>((resolve) => {
      let resolved = false;

      client.on('connect', () => {
        // Format: @recipient:message for personal, regular for broadcast
        const tcpMessage = recipient ? `@${recipient}:${user}: ${message}\n` : `${user}: ${message}\n`;
        client.write(tcpMessage);
      });

      const closeConnection = (result: NextResponse) => {
        if (resolved) return;
        resolved = true;
        client.destroy();
        resolve(result);
      };

      client.on('data', (data) => {
        const response = data.toString().trim();
        if (response.length > 0) {
          closeConnection(NextResponse.json({ message: storedMsg, response }));
        }
      });

      client.on('end', () => {
        if (!resolved) {
          closeConnection(NextResponse.json({ message: storedMsg }));
        }
      });

      client.on('error', (err) => {
        if (!resolved) {
          // Message stored locally even if C server fails
          closeConnection(NextResponse.json({ message: storedMsg, tcpError: err.message }));
        }
      });

      setTimeout(() => {
        if (!resolved) {
          closeConnection(NextResponse.json({ message: storedMsg }));
        }
      }, 1500);
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

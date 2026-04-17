import { NextRequest, NextResponse } from 'next/server';
import { createConnection } from 'net';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { message, user } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const fullMessage = user ? `User ${user}: ${message}` : message;

    // Connect to the C TCP server on localhost:3001
    const client = createConnection({ host: 'localhost', port: 3001 });

    return new Promise<NextResponse>((resolve) => {
      let response = '';
      let resolved = false;

      client.on('connect', () => {
        client.write(fullMessage + '\n'); // newline-terminated message to align text protocol
      });

      const closeConnection = (result: NextResponse) => {
        if (resolved) return;
        resolved = true;
        client.destroy();
        resolve(result);
      };

      client.on('data', (data) => {
        response += data.toString();
        // Resolve on first data packet for one-shot API request
        if (response.trim().length > 0) {
          closeConnection(NextResponse.json({ response: response.trim() }));
        }
      });

      client.on('end', () => {
        if (!resolved) {
          closeConnection(NextResponse.json({ response: response.trim() || 'OK' }));
        }
      });

      client.on('error', (err) => {
        if (!resolved) {
          closeConnection(NextResponse.json({ error: 'Failed to connect to TCP server: ' + err.message }, { status: 500 }));
        }
      });

      // Timeout after 2 seconds
      const timeoutHandle = setTimeout(() => {
        if (!resolved) {
          closeConnection(NextResponse.json({ response: response.trim() || 'Message sent' }));
        }
      }, 2000);

    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
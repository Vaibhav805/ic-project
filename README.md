This is a [Next.js](https://nextjs.org) project that provides a web interface to interact with a raw TCP server written in C.

## Features

- Web-based frontend to send messages to a TCP server
- API route that connects to the TCP server on localhost:8080
- Displays sent messages and responses from the TCP server

## Prerequisites

- Ensure your C TCP server is running on `localhost:8080`
- Node.js installed

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Enter a message in the input field and click "Send" to communicate with your TCP server.

## API

- `POST /api/tcp` - Sends a message to the TCP server and returns the response

Request body:
```json
{
  "message": "your message here"
}
```

## Notes

- The TCP connection assumes newline-terminated messages.
- If the TCP server is not running, the API will return an error.
- Timeout for TCP connection is 5 seconds.

#include <stdio.h>
#include <winsock2.h>
#include <windows.h>
#include <string.h>

#pragma comment(lib, "ws2_32.lib")

#define BUFFER_SIZE 1024

SOCKET sock;
char username[50];


DWORD WINAPI receiveMessages(LPVOID arg) {
    char buffer[BUFFER_SIZE];

    while (1) {
        int bytesReceived = recv(sock, buffer, BUFFER_SIZE, 0);

        if (bytesReceived <= 0) {
            printf("\nDisconnected from server.\n");
            exit(0);
        }

        printf("%.*s", bytesReceived, buffer);
    }
    return 0;
}

int main() {
    WSADATA wsaData;
    struct sockaddr_in server;
    char message[BUFFER_SIZE];

   
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        printf("WSAStartup failed.\n");
        return 1;
    }

    sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock == INVALID_SOCKET) {
        printf("Socket creation failed.\n");
        WSACleanup();
        return 1;
    }

    server.sin_family = AF_INET;
    server.sin_port = htons(3000);
    server.sin_addr.s_addr = inet_addr("127.0.0.1");

    // Connect to server
    if (connect(sock, (struct sockaddr*)&server, sizeof(server)) < 0) {
        printf("Connection failed.\n");
        closesocket(sock);
        WSACleanup();
        return 1;
    }

    printf("Connected to server at 127.0.0.1:3001!\n");

    printf("Enter your name: ");
    fgets(username, sizeof(username), stdin);
    username[strcspn(username, "\n")] = 0; 

    // Start receiving thread
    CreateThread(NULL, 0, receiveMessages, NULL, 0, NULL);

    // Send loop
    while (1) {
        fgets(message, sizeof(message), stdin);

        // Exit condition
        if (strncmp(message, "exit", 4) == 0) {
            printf("Exiting...\n");
            break;
        }

        
        char finalMessage[BUFFER_SIZE + 50];
        int len = snprintf(finalMessage, sizeof(finalMessage), "%s: %s", username, message);
        if (len < 0 || len >= (int)sizeof(finalMessage)) {
            printf("Message too long. Try shorter text.\n");
            continue;
        }

        int bytesSent = send(sock, finalMessage, len, 0);
        if (bytesSent == SOCKET_ERROR) {
            printf("Send failed (code %d). Closing connection.\n", WSAGetLastError());
            break;
        }
    }

    
    closesocket(sock);
    WSACleanup();

    return 0;
}
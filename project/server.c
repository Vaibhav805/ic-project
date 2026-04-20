#include <stdio.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <stdbool.h>
#include <windows.h>

#pragma comment(lib, "ws2_32.lib")
#define MAX_CLIENTS 100

SOCKET clients[MAX_CLIENTS];
int clientCount = 0;

HANDLE mutex;
DWORD WINAPI handleClient(LPVOID arg) {
    SOCKET clientSocket = (SOCKET)arg;
    char buffer[1024];

    while (1) {
        int bytesReceived = recv(clientSocket, buffer, sizeof(buffer), 0);

        if (bytesReceived <= 0) {
            printf("Client disconnected\n");
            break;
        }

        printf("Message: %.*s\n", bytesReceived, buffer);

        WaitForSingleObject(mutex, INFINITE);
        
        for (int i = 0; i < clientCount; i++) {
            if (clients[i] != clientSocket) {
                send(clients[i], buffer, bytesReceived, 0);
            }
        }

        ReleaseMutex(mutex);
    }

    
    WaitForSingleObject(mutex, INFINITE);
    for (int i = 0; i < clientCount; i++) {
        if (clients[i] == clientSocket) {
            for (int j = i; j < clientCount - 1; j++) {
                clients[j] = clients[j + 1];
            }
            clientCount--;
            break;
        }
    }
    ReleaseMutex(mutex);

    closesocket(clientSocket);
    return 0;
}

int main() {
    WSADATA wsaData;
    SOCKET listeningSocket, clientSocket;
    struct sockaddr_in serverAddr, clientAddr;
    int clientAddrSize = sizeof(clientAddr);
    mutex = CreateMutex(NULL, FALSE, NULL);

   
    WSAStartup(MAKEWORD(2, 2), &wsaData);

   
    listeningSocket = socket(AF_INET, SOCK_STREAM, 0);

    
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_port = htons(3000);
    serverAddr.sin_addr.s_addr = inet_addr("127.0.0.1"); 

    if (bind(listeningSocket, (struct sockaddr*)&serverAddr, sizeof(serverAddr)) == SOCKET_ERROR) {
        printf("Bind failed with error: %d\n", WSAGetLastError());
        closesocket(listeningSocket);
        WSACleanup();
        return 1;
    }

    
   
    if(listen(listeningSocket, 5) != 0) {
        printf("Listen failed with error: %d\n", WSAGetLastError());
        closesocket(listeningSocket);
        WSACleanup();
        return 1;
    }
    printf("Server is listening on port 3000...\n");

    
    while(true) {
        if (clientCount >= MAX_CLIENTS) {
            printf("Max clients reached. Rejecting new connection.\n");
            clientSocket = accept(listeningSocket, (struct sockaddr*)&clientAddr, &clientAddrSize);
            if (clientSocket != INVALID_SOCKET) {
                closesocket(clientSocket);
            }
            continue;
        }

        clientSocket = accept(listeningSocket, (struct sockaddr*)&clientAddr, &clientAddrSize);
        if (clientSocket == INVALID_SOCKET) {
            printf("Accept failed with error: %d\n", WSAGetLastError());
            continue;
        }
        printf("Client connected!\n");

        WaitForSingleObject(mutex, INFINITE);
        clients[clientCount++] = clientSocket;
        ReleaseMutex(mutex);

        
        CreateThread(NULL, 0, handleClient, (LPVOID)clientSocket, 0, NULL);
    }
   

    // 6. Cleanup
    closesocket(clientSocket);
    closesocket(listeningSocket);
    WSACleanup();

    return 0;
}
#!/bin/bash

# Start server script with SSL certificate handling for macOS
# This script ensures that SSL certificates are properly set up before starting the server

# Text colors
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
BLUE="\033[0;34m"
RED="\033[0;31m"
RESET="\033[0m"

echo -e "${BLUE}Starting server with SSL certificate fixes...${RESET}"

# 1. First, find the Python executable
PYTHON_EXEC=$(which python3)
if [ -z "$PYTHON_EXEC" ]; then
    PYTHON_EXEC=$(which python)
fi

echo -e "${GREEN}Using Python: ${PYTHON_EXEC}${RESET}"

# 2. Install required packages from requirements.txt if it exists
if [ -f "requirements.txt" ]; then
    echo -e "${YELLOW}Installing packages from requirements.txt...${RESET}"
    $PYTHON_EXEC -m pip install -r requirements.txt
else
    echo -e "${YELLOW}requirements.txt not found, installing essential packages...${RESET}"
    $PYTHON_EXEC -m pip install --upgrade certifi urllib3 websockets requests openai fastapi uvicorn python-dotenv
fi

# 3. Set environment variables for SSL
echo -e "${YELLOW}Setting SSL environment variables...${RESET}"
export PYTHONHTTPSVERIFY=0
export SSL_CERT_FILE=$(python3 -c "import certifi; print(certifi.where())")
export REQUESTS_CA_BUNDLE=$SSL_CERT_FILE
export CURL_CA_BUNDLE=$SSL_CERT_FILE
export NODE_TLS_REJECT_UNAUTHORIZED=0
export DEBUG=True

echo -e "${GREEN}SSL certificate path: ${SSL_CERT_FILE}${RESET}"

# 4. Apply macOS-specific fixes if on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${YELLOW}Detected macOS, applying additional fixes...${RESET}"
    
    # Check if Install Certificates.command exists in common locations
    CERT_COMMAND=""
    for version in 3.11 3.10 3.9 3.8; do
        if [ -f "/Applications/Python ${version}/Install Certificates.command" ]; then
            CERT_COMMAND="/Applications/Python ${version}/Install Certificates.command"
            break
        fi
    done
    
    if [ ! -z "$CERT_COMMAND" ]; then
        echo -e "${GREEN}Running certificate installer: ${CERT_COMMAND}${RESET}"
        bash "$CERT_COMMAND"
    else
        echo -e "${YELLOW}Certificate installer not found, trying alternative method...${RESET}"
        $PYTHON_EXEC -m pip install --upgrade certifi
    fi
fi

# 5. Test SSL connectivity to OpenAI
echo -e "${YELLOW}Testing SSL connectivity to OpenAI...${RESET}"
TEST_RESULT=$($PYTHON_EXEC -c "
import ssl
import socket
import sys
try:
    context = ssl.create_default_context()
    with socket.create_connection(('api.openai.com', 443)) as sock:
        with context.wrap_socket(sock, server_hostname='api.openai.com') as ssock:
            print(f'SSL connection successful! Certificate: {ssock.getpeercert()[\"subject\"][0][0][1]}')
    sys.exit(0)
except Exception as e:
    print(f'SSL connection failed: {e}')
    sys.exit(1)
")

if [ $? -eq 0 ]; then
    echo -e "${GREEN}SSL connectivity test successful: ${TEST_RESULT}${RESET}"
else
    echo -e "${RED}SSL connectivity test failed: ${TEST_RESULT}${RESET}"
    echo -e "${YELLOW}Proceeding with unverified SSL context...${RESET}"
fi

# 6. Start the server with SSL fixes
echo -e "${BLUE}Starting server with DEBUG=True...${RESET}"
$PYTHON_EXEC -m app.main 
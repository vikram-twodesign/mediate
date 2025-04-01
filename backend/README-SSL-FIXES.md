# SSL Certificate Fix Guide for macOS Development

This guide helps resolve SSL certificate verification issues that commonly occur in Python applications running on macOS, especially when connecting to WebSocket APIs like OpenAI's transcription service.

## Quick Start

To start the server with all SSL fixes applied:

```bash
cd backend
chmod +x start_server.sh
./start_server.sh
```

The script will:
1. Install necessary packages
2. Configure SSL environment variables
3. Run macOS certificate fixes if needed
4. Test SSL connectivity to OpenAI
5. Start the server with debug mode enabled

## Common SSL Issues on macOS

macOS has particular SSL certificate handling that can cause Python's SSL verification to fail with errors like:
```
[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate
```

These issues happen because:
1. Python on macOS does not use the system's trust store by default
2. The SSL verification is more strict than on other platforms
3. Python installed via Homebrew or installer might not have SSL certificates configured properly

## Manual Fixes

If you need to manually fix SSL certificate issues:

### 1. Update Certificates

```bash
# Install or update certifi
pip install --upgrade certifi

# Find where your certificates are located
python -c "import certifi; print(certifi.where())"
```

### 2. Set Environment Variables

```bash
# Set these environment variables before running your Python app
export SSL_CERT_FILE=$(python -c "import certifi; print(certifi.where())")
export REQUESTS_CA_BUNDLE=$SSL_CERT_FILE
export PYTHONHTTPSVERIFY=0  # Only in development!
```

### 3. Run macOS Certificate Installer

Find and run the certificate installer that comes with your Python installation:

```bash
# For Python 3.9 example (adjust path for your Python version)
/Applications/Python\ 3.9/Install\ Certificates.command
```

### 4. Disable SSL Verification in Development

In development code, you can use:

```python
import ssl
ssl._create_default_https_context = ssl._create_unverified_context
```

**Note:** This should NEVER be used in production as it disables security checks.

## Troubleshooting

1. **Testing SSL Connection:**
   ```python
   python -c "import ssl; import socket; context = ssl.create_default_context(); socket.create_connection(('api.openai.com', 443)); context.wrap_socket(sock, server_hostname='api.openai.com')"
   ```

2. **Verifying Certificate Path:**
   ```python
   python -c "import ssl; print(ssl.get_default_verify_paths())"
   ```

3. **Check OpenSSL Version:**
   ```bash
   python -c "import ssl; print(ssl.OPENSSL_VERSION)"
   ```

## Contact

If you continue to have SSL issues, please submit a GitHub issue with:
- Your macOS version
- Python version
- Installation method (Homebrew, Python installer, etc.)
- Complete error message 
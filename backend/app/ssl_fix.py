"""
SSL Certificate Fix Module

This module provides a comprehensive solution for SSL certificate validation issues in Python,
especially on macOS systems.

It applies several fixes:
1. Sets up environment variables for SSL certificate paths
2. Adds macOS-specific fixes
3. Configures urllib3 to use the correct certificates
4. Patches SSL context creation to accept self-signed certificates in development mode
"""

import os
import sys
import logging
import ssl
import certifi
import urllib3
import requests
from pathlib import Path

logger = logging.getLogger(__name__)

def apply_ssl_fixes(debug_mode=None):
    """
    Apply comprehensive SSL fixes to ensure API connections work properly.

    Args:
        debug_mode (bool, optional): If True, disables verification in development mode.
                                      If None, uses the DEBUG environment variable.
    """
    # Determine if we're in debug/development mode
    if debug_mode is None:
        debug_mode = os.environ.get('DEBUG', 'False').lower() in ('true', '1', 't')
    
    logger.info(f"Applying SSL fixes (Debug mode: {debug_mode})")
    
    # 1. Set certificate paths using certifi
    cert_path = certifi.where()
    os.environ['SSL_CERT_FILE'] = cert_path
    os.environ['REQUESTS_CA_BUNDLE'] = cert_path
    os.environ['CURL_CA_BUNDLE'] = cert_path
    
    # 2. Configure urllib3
    try:
        urllib3.util.ssl_.DEFAULT_CERTS = cert_path
    except AttributeError:
        logger.warning("Could not set urllib3.util.ssl_.DEFAULT_CERTS")
    
    # 3. Apply macOS-specific fixes
    if sys.platform == 'darwin':
        _apply_macos_fixes(cert_path)
    
    # 4. In development mode, modify default SSL context to be more permissive
    if debug_mode:
        _apply_development_mode_fixes()
        
    logger.info("SSL fixes applied successfully")

def _apply_macos_fixes(cert_path):
    """Apply macOS-specific certificate fixes."""
    logger.info("Applying macOS-specific SSL fixes")
    
    # Try to find and run the macOS certificate installer if needed
    for version in ["3.11", "3.10", "3.9", "3.8", "3.7"]:
        cert_command = Path(f"/Applications/Python {version}/Install Certificates.command")
        if cert_command.exists():
            logger.info(f"Found certificate installer at {cert_command}")
            # We don't actually run it here as it might require user interaction
            # Instead we've already set the paths using certifi
            break
            
    # Set OpenSSL environment variables
    os.environ['OPENSSL_CONF'] = ''

def _apply_development_mode_fixes():
    """Apply permissive SSL fixes for development mode only."""
    logger.warning("Applying development mode SSL fixes - NOT SECURE FOR PRODUCTION")
    
    # 1. Set environment variable to disable Python's HTTPS verification
    os.environ['PYTHONHTTPSVERIFY'] = '0'
    
    # 2. Disable verification for the requests library
    old_merge_environment_settings = requests.Session.merge_environment_settings
    
    def new_merge_environment_settings(self, url, proxies, stream, verify, cert):
        settings = old_merge_environment_settings(self, url, proxies, stream, verify, cert)
        settings['verify'] = False
        return settings
    
    requests.Session.merge_environment_settings = new_merge_environment_settings
    
    # 3. Patch the default SSL context
    try:
        _create_default_https_context = ssl._create_default_https_context
        ssl._create_default_https_context = ssl._create_unverified_context
        logger.info("Patched SSL context to use unverified context")
    except AttributeError:
        logger.warning("Could not patch ssl._create_default_https_context")
    
    # 4. Configure urllib3 to disable warnings
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# If this module is run directly, apply SSL fixes
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    apply_ssl_fixes() 
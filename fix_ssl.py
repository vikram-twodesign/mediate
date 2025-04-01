#!/usr/bin/env python
"""
Fix SSL Certificate Verification Issues

This script directly patches the Python SSL module to bypass certificate verification
for development purposes ONLY. DO NOT use this in production!

Usage:
1. Run this script directly: python fix_ssl.py
2. Or import it in your application: import fix_ssl

After running this script, restart your application for the changes to take effect.
"""

import os
import ssl
import sys
import site
import certifi

def apply_direct_patch():
    """Apply a direct patch to the current process, disabling SSL verification."""
    # Create an unverified context
    ssl._create_default_https_context = ssl._create_unverified_context
    print("✅ Applied direct SSL verification bypass in the current process")

def install_permanent_patch():
    """
    Install a permanent patch that will be applied automatically when Python starts.
    This is useful for development environments.
    """
    # Create the patch content
    patch_content = """# SSL certificate verification bypass for development
# WARNING: DO NOT USE IN PRODUCTION!

import ssl
ssl._create_default_https_context = ssl._create_unverified_context
print("⚠️ SSL certificate verification disabled (development mode)")
"""
    
    # Get the site-packages directory
    site_packages = site.getsitepackages()[0]
    
    # Create patch files
    ssl_patch_path = os.path.join(site_packages, "ssl_patch.py")
    pth_file_path = os.path.join(site_packages, "ssl_patch.pth")
    
    # Write the module file
    with open(ssl_patch_path, "w") as f:
        f.write(patch_content)
    
    # Write the .pth file to auto-import the module
    with open(pth_file_path, "w") as f:
        f.write("import ssl_patch")
    
    print(f"✅ Created permanent SSL patch at {ssl_patch_path}")
    print(f"✅ Created auto-import file at {pth_file_path}")
    print("ℹ️ The patch will be applied automatically when Python starts")

def update_certificates():
    """Update the certifi package to get the latest certificates."""
    try:
        print("📦 Updating certifi package for latest certificates...")
        import pip
        pip.main(["install", "--upgrade", "certifi"])
        print(f"✅ Updated certificates at: {certifi.where()}")
    except Exception as e:
        print(f"❌ Error updating certificates: {e}")

def main():
    print("🔒 SSL Certificate Verification Fix")
    print("====================================")
    print("⚠️ WARNING: These fixes are for DEVELOPMENT use only!")
    print("⚠️ DO NOT use these in a production environment!")
    print()
    
    # Show options
    print("Options:")
    print("1. Apply direct patch (temporary, current process only)")
    print("2. Install permanent patch (all Python processes)")
    print("3. Update SSL certificates")
    print("4. Apply all fixes")
    print("5. Exit")
    
    # Get user choice
    choice = input("\nSelect an option (1-5): ")
    
    if choice == "1":
        apply_direct_patch()
    elif choice == "2":
        install_permanent_patch()
    elif choice == "3":
        update_certificates()
    elif choice == "4":
        apply_direct_patch()
        install_permanent_patch()
        update_certificates()
    else:
        print("Exiting without making changes.")
    
    if choice in ["1", "2", "4"]:
        print("\n⚠️ IMPORTANT: Restart your application for changes to take effect!")

if __name__ == "__main__":
    # Apply direct patch to current process
    apply_direct_patch()
    
    # Offer to install permanent patch
    if input("Do you want to install the permanent SSL patch for all Python processes? (y/n): ").lower() == "y":
        install_permanent_patch()
        print("ℹ️ Permanent patch installed.")
    
    print("\n✅ SSL verification has been disabled for this session.")
    print("⚠️ Remember: This is for development use only! Never use in production!")
    print("🔄 Restart your backend server now.") 
#!/bin/bash

# Cleanup script for removing old Google Gemini service files
# Run this script after confirming the Deepgram services are working correctly

echo "Creating backups of files before deletion..."

# Create a backup directory
mkdir -p ./gemini_backup

# Backup the Gemini service files
if [ -f "./backend/app/services/gemini_service.py" ]; then
    cp ./backend/app/services/gemini_service.py ./gemini_backup/
    echo "Backed up gemini_service.py"
fi

if [ -f "./backend/app/services/gemini_streaming_service.py" ]; then
    cp ./backend/app/services/gemini_streaming_service.py ./gemini_backup/
    echo "Backed up gemini_streaming_service.py"
fi

if [ -f "./backend/app/services/transcription_service.py" ]; then
    cp ./backend/app/services/transcription_service.py ./gemini_backup/
    echo "Backed up transcription_service.py"
fi

echo "Backups created in ./gemini_backup/"
echo ""

echo "Removing old Gemini service files..."

# Remove the files
if [ -f "./backend/app/services/gemini_service.py" ]; then
    rm ./backend/app/services/gemini_service.py
    echo "Removed gemini_service.py"
fi

if [ -f "./backend/app/services/gemini_streaming_service.py" ]; then
    rm ./backend/app/services/gemini_streaming_service.py
    echo "Removed gemini_streaming_service.py"
fi

if [ -f "./backend/app/services/transcription_service.py" ]; then
    rm ./backend/app/services/transcription_service.py
    echo "Removed transcription_service.py"
fi

echo ""
echo "Cleanup complete. Old files were backed up to ./gemini_backup/ before removal."
echo "Remember to update the import statements in any files that may have been referencing these services." 
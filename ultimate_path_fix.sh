#!/bin/bash

# Antigravity Ultimate Path & Metadata Fixer (v4)
# This script addresses the "Invisible History" by targeting the correct Windows AppData paths
# and repairing session metadata that the VS Code UI relies on.

WSL_BASE="/home/ramon/.gemini/antigravity"
WIN_GEMINI="/mnt/c/Users/ramon/.gemini/antigravity"

# Get Win AppData path dynamically from PowerShell (mapped to /mnt/c/...)
WIN_APPDATA_RAW=$(powershell.exe -Command "echo \$env:APPDATA" | tr -d '\r')
WIN_APPDATA_PATH=$(echo "$WIN_APPDATA_RAW" | sed 's/C:\\/\/mnt\/c\//;s/\\/\//g')
WIN_ROAMING="$WIN_APPDATA_PATH/antigravity"

echo "=== Antigravity Ultimate Fixer (v4) ==="
echo "[DEBUG] WSL Path: $WSL_BASE"
echo "[DEBUG] Win Gemini: $WIN_GEMINI"
echo "[DEBUG] Win Roaming: $WIN_ROAMING"

# 1. Repair Metadata in WSL Staging Area
echo "[INFO] Repairing session metadata..."
for pb_file in "$WSL_BASE/conversations"/*.pb; do
    [ -e "$pb_file" ] || continue
    filename=$(basename "$pb_file")
    session_id="${filename%.pb}"
    
    # Create the brain folder if missing
    mkdir -p "$WSL_BASE/brain/$session_id"
    
    # Create metadata.json if missing
    if [ ! -f "$WSL_BASE/brain/$session_id/metadata.json" ]; then
        echo "[FIX] Creating metadata.json for $session_id"
        # We try to use a placeholder title. Ideally, we'd extract it from .pb, 
        # but the filename is better than nothing for visibility.
        echo "{\"Title\": \"Recovered Session ($session_id)\", \"Created\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$WSL_BASE/brain/$session_id/metadata.json"
    fi
done

# 2. Create the Diagnostic Success session
DIAG_ID="HISTORY_FIX_SUCCESS_CHECK"
echo "If you see this, the repair worked!" > "$WSL_BASE/conversations/$DIAG_ID.pb"
mkdir -p "$WSL_BASE/brain/$DIAG_ID"
echo "{\"Title\": \"✅ HISTORY_FIX_SUCCESS_CHECK\", \"Created\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$WSL_BASE/brain/$DIAG_ID/metadata.json"

# 3. Perform Syncs
echo "[INFO] Syncing to Windows Gemini path..."
mkdir -p "$WIN_GEMINI/conversations" "$WIN_GEMINI/brain"
rsync -au "$WSL_BASE/conversations/" "$WIN_GEMINI/conversations/"
rsync -au "$WSL_BASE/brain/" "$WIN_GEMINI/brain/"

echo "[INFO] Syncing to Windows AppData path..."
mkdir -p "$WIN_ROAMING/conversations" "$WIN_ROAMING/brain"
rsync -au "$WSL_BASE/conversations/" "$WIN_ROAMING/conversations/"
rsync -au "$WSL_BASE/brain/" "$WIN_ROAMING/brain/"

# 4. Set Permissions
chmod -R 755 "$WSL_BASE"

# 5. Summary
WSL_COUNT=$(ls -1 "$WSL_BASE/conversations"/*.pb 2>/dev/null | wc -l)
ROAMING_COUNT=$(ls -1 "$WIN_ROAMING/conversations"/*.pb 2>/dev/null | wc -l)

echo ""
echo "[SUCCESS] WSL Sessions found: $WSL_COUNT"
echo "[SUCCESS] Windows AppData Sessions synced: $ROAMING_COUNT"
echo ""
echo "!!! ACTION REQUIRED !!!"
echo "1. Close ALL VS Code windows completely."
echo "2. Reopen VS Code."
echo "3. Look for '✅ HISTORY_FIX_SUCCESS_CHECK' in history."
echo "========================"

#!/bin/bash

# Antigravity FINAL Identity & History Restorer
# This script unifies the fragmented Machine IDs and merges all historical data.

# 1. Configuration
WIN_ID="de2f2cd6-8363-4aa0-be2b-f69bdb4c80db"
WSL_GEMINI="/home/ramon/.gemini/antigravity"
WSL_SERVER="/home/ramon/.antigravity-server/data"
WIN_GEMINI="/mnt/c/Users/ramon/.gemini/antigravity"
WIN_ROAMING="/mnt/c/Users/ramon/AppData/Roaming/antigravity"

BACKUP_DIR="/home/ramon/antigravity_emergency_backup_$(date +%Y%m%d_%H%M%S)"

echo "=== Antigravity FINAL Restore Utility ==="
echo "[1/6] Creating emergency backups..."
mkdir -p "$BACKUP_DIR/WSL_GEMINI" "$BACKUP_DIR/WSL_SERVER" "$BACKUP_DIR/WIN_GEMINI" "$BACKUP_DIR/WIN_ROAMING"
cp -r "$WSL_GEMINI"/* "$BACKUP_DIR/WSL_GEMINI/" 2>/dev/null
cp -r "$WSL_SERVER"/* "$BACKUP_DIR/WSL_SERVER/" 2>/dev/null
cp -r "$WIN_GEMINI"/* "$BACKUP_DIR/WIN_GEMINI/" 2>/dev/null
cp -r "$WIN_ROAMING"/* "$BACKUP_DIR/WIN_ROAMING/" 2>/dev/null

echo "[2/6] Unifying Identity IDs to $WIN_ID..."
echo "$WIN_ID" > "$WSL_GEMINI/installation_id"
echo "$WIN_ID" > "$WSL_SERVER/machineid"
echo "$WIN_ID" > "$WIN_GEMINI/installation_id"
echo "$WIN_ID" > "$WIN_ROAMING/machineid"

echo "[3/6] Consolidating all session data into WSL staging area..."
# Merge all found .pb files from all sources into WSL_GEMINI/conversations
mkdir -p "$WSL_GEMINI/conversations"
cp -n "$WIN_GEMINI/conversations"/*.pb "$WSL_GEMINI/conversations/" 2>/dev/null
cp -n "$WIN_ROAMING/conversations"/*.pb "$WSL_GEMINI/conversations/" 2>/dev/null

echo "[4/6] Repairing metadata and brain folders..."
mkdir -p "$WSL_GEMINI/brain"
for pb_file in "$WSL_GEMINI/conversations"/*.pb; do
    [ -e "$pb_file" ] || continue
    filename=$(basename "$pb_file")
    session_id="${filename%.pb}"
    
    # Skip the diagnostic ones for now
    if [[ "$session_id" == "HISTORY_"* ]] || [[ "$session_id" == "HEALED_"* ]] || [[ "$session_id" == "COMPLETE_"* ]]; then
        continue
    fi

    # Ensure brain folder exists
    mkdir -p "$WSL_GEMINI/brain/$session_id"
    
    # Ensure metadata.json exists
    if [ ! -f "$WSL_GEMINI/brain/$session_id/metadata.json" ]; then
        echo "{\"Title\": \"Recovered Session ($session_id)\", \"Created\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$WSL_GEMINI/brain/$session_id/metadata.json"
    fi
done

echo "[5/6] Creating FINAL RESTORE SUCCESS marker..."
MARKER_ID="!!!_HISTORY_RESTORED_SUCCESS_!!!"
echo "If you see this, the identity unification worked!" > "$WSL_GEMINI/conversations/$MARKER_ID.pb"
mkdir -p "$WSL_GEMINI/brain/$MARKER_ID"
echo "{\"Title\": \"✅ !!!_HISTORY_RESTORED_SUCCESS_!!!\", \"Created\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$WSL_GEMINI/brain/$MARKER_ID/metadata.json"

echo "[6/6] Synchronizing master set to all Windows locations..."
rsync -au "$WSL_GEMINI/conversations/" "$WIN_GEMINI/conversations/"
rsync -au "$WSL_GEMINI/brain/" "$WIN_GEMINI/brain/"
rsync -au "$WSL_GEMINI/conversations/" "$WIN_ROAMING/conversations/"
rsync -au "$WSL_GEMINI/brain/" "$WIN_ROAMING/brain/"

# Final Check
WSL_ID=$(cat "$WSL_GEMINI/installation_id")
ROAM_ID=$(cat "$WIN_ROAMING/machineid")
FILE_COUNT=$(ls -1 "$WSL_GEMINI/conversations"/*.pb | wc -l)

echo ""
echo "=== Summary ==="
echo "Identity (WSL):  $WSL_ID"
echo "Identity (Win):  $ROAM_ID"
echo "Total Sessions:  $FILE_COUNT"
echo ""
echo "!!! IMPORTANT: CLOSE ALL VS CODE WINDOWS COMPLETELY !!!"
echo "Reopen and check for the session: ✅ !!!_HISTORY_RESTORED_SUCCESS_!!!"
echo "================"

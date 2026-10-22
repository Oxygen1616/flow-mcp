@echo off
title Google Flow MCP Launcher
echo Starting Google Flow Chrome on port 9333...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="C:\Users\Kasutaja\.flow-mcp\chrome-profile" --remote-debugging-port=9333 --disable-extensions --no-first-run --no-default-browser-check "https://flow.google.com/?hl=en"
exit

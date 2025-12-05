# Insert Admin API Endpoints into server.js

Write-Host "Inserting admin API endpoints..." -ForegroundColor Cyan

# Read API endpoints (skip first 4 lines)
$apiCode = Get-Content "admin-api-endpoints.js" | Select-Object -Skip 4 | Out-String

# Read server.js
$serverCode = Get-Content "server.js" -Raw

# Check if already inserted
if ($serverCode -match '/api/admin/materials') {
    Write-Host "Endpoints already exist!" -ForegroundColor Yellow
    exit 0
}

# Find app.listen position
$index = $serverCode.IndexOf('app.listen(PORT')
if ($index -eq -1) {
    Write-Host "ERROR: Cannot find app.listen" -ForegroundColor Red
    exit 1
}

# Insert API code before app.listen
$before = $serverCode.Substring(0, $index).TrimEnd()
$after = $serverCode.Substring($index)
$newCode = $before + "`r`n`r`n" + $apiCode.TrimEnd() + "`r`n`r`n" + $after

# Backup and write
Copy-Item "server.js" "server.js.backup"
$newCode | Set-Content "server.js" -NoNewline

Write-Host "Success! API endpoints inserted." -ForegroundColor Green
Write-Host "Restart server with: npm start" -ForegroundColor Yellow

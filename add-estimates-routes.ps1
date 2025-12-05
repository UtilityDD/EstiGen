# Add estimates routes to server.js

$content = Get-Content "server.js" -Raw

# Check if already added
if ($content -match 'estimatesRoutes') {
    Write-Host "Estimates routes already exist!" -ForegroundColor Yellow
    exit 0
}

# Find the position after middleware
$pattern = "app\.use\(express\.static\(__dirname\)\);"
if ($content -notmatch $pattern) {
    Write-Host "ERROR: Cannot find middleware section" -ForegroundColor Red
    exit 1
}

# Insert the estimates routes
$insertion = "`r`n`r`n// Import and use estimates routes`r`nconst estimatesRoutes = require('./routes/estimates');`r`napp.use('/api/estimates', estimatesRoutes(supabase));"

$content = $content -replace "($pattern)", "`$1$insertion"

# Save
Set-Content "server.js" $content -NoNewline

Write-Host "✓ Successfully added estimates routes to server.js" -ForegroundColor Green

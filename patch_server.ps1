$serverPath = "c:\Users\rouma\Desktop\Dipankar\EstiGen - 1\server.js"
$content = Get-Content $serverPath -Raw

# Find the line where we add the import
$importLine = "app.use(express.static(__dirname));"
$newImport = @"
app.use(express.static(__dirname));

// Import routes
const estimatesRoutes = require('./routes/estimates');
"@

$content = $content -replace [regex]::Escape($importLine), $newImport

# Find where app.listen starts and insert the route registration before it
$listenPattern = "app\.listen\(PORT, \(\) => \{"
$routeRegistration = @"
// Register estimates API routes
app.use('/api/estimates', estimatesRoutes(supabase));

app.listen(PORT, () => {
"@

$content = $content -replace $listenPattern, $routeRegistration

# Write back
$content | Out-File -FilePath $serverPath -Encoding UTF8 -NoNewline

Write-Host "✅ Server.js updated with estimates routes"

$indexPath = "c:\Users\rouma\Desktop\Dipankar\EstiGen - 1\index.html"
$lines = Get-Content $indexPath

# Find the line numbers for tags
$styleEndLine = -1
$scriptStartLine = -1
$scriptEndLine = -1

for ($i = 0; $i  -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^\s*</style>") {
        $styleEndLine = $i
    }
    if ($lines[$i] -match "^\s*<script>") {
        $scriptStartLine = $i
    }
    if ($lines[$i] -match "^\s*</script>") {
        $scriptEndLine = $i
    }
}

Write-Host "Style ends at line: $styleEndLine"
Write-Host "Script starts at line: $scriptStartLine"
Write-Host "Script ends at line: $scriptEndLine"

# Build the new content
$newContent = @()

# Add lines 0-7 (DOCTYPE through stylesheet link)
for ($i = 0; $i -le 7; $i++) {
    $newContent += $lines[$i]
}

# Skip lines 8 to $styleEndLine (all inline CSS)

# Add lines from after </style> to before <script>
for ($i = $styleEndLine + 1; $i -lt $scriptStartLine; $i++) {
    $newContent += $lines[$i]
}

# Add the script tag for external JS
$newContent += "    <script src=`"script.js`"></script>"
$newContent += ""

# Add lines after </script> to end
for ($i = $scriptEndLine + 1; $i -lt $lines.Count; $i++) {
    $newContent += $lines[$i]
}

# Write the new content
$newContent | Out-File -FilePath $indexPath -Encoding UTF8
Write-Host "File refactored successfully!"

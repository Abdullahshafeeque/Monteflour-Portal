# Run this from your project root folder (monteflour-portal)

$outputFile = "combined_code.txt"
$excludeDirs = @("node_modules", ".next", ".git")
$includeExtensions = @(".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".sql", ".md")

if (Test-Path $outputFile) { Remove-Item $outputFile }

Get-ChildItem -Path . -Recurse -File | Where-Object {
    $path = $_.FullName
    $ext = $_.Extension
    $excluded = $false
    foreach ($dir in $excludeDirs) {
        if ($path -like "*\$dir\*") { $excluded = $true }
    }
    (-not $excluded) -and ($includeExtensions -contains $ext)
} | ForEach-Object {
    $relativePath = $_.FullName.Substring((Get-Location).Path.Length + 1)
    Add-Content -Path $outputFile -Value "`n`n===== FILE: $relativePath =====`n"
    Get-Content $_.FullName | Add-Content -Path $outputFile
}

Write-Host "Done! Combined file saved as $outputFile"
# Siftline - Session Reset Script
$SessionDir = "$env:APPDATA\ai-council\Partitions"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Siftline - Logout / Session Reset" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Select AI to logout from:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  [1] ChatGPT logout"
Write-Host "  [2] Claude logout"
Write-Host "  [3] Gemini logout"
Write-Host "  [4] Perplexity logout"
Write-Host "  [5] ALL logout (reset everything)"
Write-Host "  [0] Cancel"
Write-Host ""

$choice = Read-Host "Enter number"

function Remove-Session($name) {
    $path = "$SessionDir\$name"
    if (Test-Path $path) {
        Remove-Item $path -Recurse -Force
        Write-Host "OK: $name session cleared!" -ForegroundColor Green
    } else {
        Write-Host "SKIP: No session data found for $name" -ForegroundColor Yellow
    }
}

Write-Host ""

switch ($choice) {
    "1" { Remove-Session "chatgpt" }
    "2" { Remove-Session "claude" }
    "3" { Remove-Session "gemini" }
    "4" { Remove-Session "perplexity" }
    "5" {
        Remove-Session "chatgpt"
        Remove-Session "claude"
        Remove-Session "gemini"
        Remove-Session "perplexity"
    }
    "0" { Write-Host "Cancelled." -ForegroundColor Gray }
    default { Write-Host "Invalid input." -ForegroundColor Red }
}

Write-Host ""
Write-Host "Restart Siftline to login with a new account." -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"

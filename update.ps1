# Security Council Extension — Update Script
# Pulls latest from the repo and refreshes user-level install.
# Compares checksums to skip copy if already up-to-date.
#
# Usage:
#   .\update.ps1                # Install or update
#   .\update.ps1 -Check         # Check only, don't update
#   .\update.ps1 -Verbose       # Show details

[CmdletBinding()]
param(
    [switch]$Check
)

$ErrorActionPreference = "Stop"

# ─── Config ──────────────────────────────────────────────────────────────────

$RepoUrl = "https://github.com/beeisabelm/copilot-cli-knowledge-agents"
$RepoDir = Join-Path $env:USERPROFILE "copilot-cli-knowledge-agents"
$ExtensionSource = Join-Path $RepoDir ".github\extensions\security"
$ExtensionTarget = Join-Path $env:USERPROFILE ".copilot\extensions\security"
$VersionFile = Join-Path $ExtensionTarget ".version"

# ─── Helpers ─────────────────────────────────────────────────────────────────

function Get-ExtensionChecksum {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return "not-installed" }
    
    # Hash all source files (sorted for determinism), exclude .git and .version
    $files = Get-ChildItem -Path $Path -Recurse -File |
        Where-Object { $_.Name -ne ".version" -and $_.FullName -notlike "*\.git\*" } |
        Sort-Object FullName

    if ($files.Count -eq 0) { return "empty" }

    $hashes = $files | ForEach-Object {
        $relativePath = $_.FullName.Substring($Path.Length + 1)
        $fileHash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash
        "$relativePath=$fileHash"
    }

    # Combined hash of all file hashes
    $combined = ($hashes -join "`n")
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($combined)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $hashBytes = $sha.ComputeHash($bytes)
    return [BitConverter]::ToString($hashBytes).Replace("-", "").ToLower()
}

function Write-VersionFile {
    param([string]$Checksum, [string]$TargetPath)
    $versionInfo = @{
        checksum    = $Checksum
        updatedAt   = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
        source      = $RepoUrl
    }
    $versionInfo | ConvertTo-Json | Set-Content (Join-Path $TargetPath ".version") -Encoding UTF8
}

# ─── Step 1: Ensure repo is cloned ──────────────────────────────────────────

if (-not (Test-Path $RepoDir)) {
    Write-Host "📦 Cloning repo..." -ForegroundColor Cyan
    git clone $RepoUrl $RepoDir
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Clone failed. Check your network and GitHub access." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "🔄 Pulling latest..." -ForegroundColor Cyan
    Push-Location $RepoDir
    git pull --ff-only 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  git pull failed — local changes may exist. Trying anyway..." -ForegroundColor Yellow
    }
    Pop-Location
}

# ─── Step 2: Verify source exists ───────────────────────────────────────────

if (-not (Test-Path (Join-Path $ExtensionSource "extension.mjs"))) {
    Write-Host "❌ Extension source not found at: $ExtensionSource" -ForegroundColor Red
    Write-Host "   Expected: extension.mjs, config.json, checklists/, prompts/" -ForegroundColor Red
    exit 1
}

# ─── Step 3: Compare checksums ──────────────────────────────────────────────

$sourceChecksum = Get-ExtensionChecksum $ExtensionSource
$targetChecksum = Get-ExtensionChecksum $ExtensionTarget

Write-Verbose "Source checksum: $sourceChecksum"
Write-Verbose "Target checksum: $targetChecksum"

if ($sourceChecksum -eq $targetChecksum) {
    Write-Host "✅ Already up-to-date (checksum: $($sourceChecksum.Substring(0,12))...)" -ForegroundColor Green
    exit 0
}

# ─── Step 4: Show what changed ──────────────────────────────────────────────

if ($targetChecksum -eq "not-installed") {
    Write-Host "🆕 First install detected" -ForegroundColor Cyan
} else {
    Write-Host "📋 Update available" -ForegroundColor Yellow
    Write-Host "   Installed: $($targetChecksum.Substring(0,12))..." -ForegroundColor DarkGray
    Write-Host "   Latest:    $($sourceChecksum.Substring(0,12))..." -ForegroundColor DarkGray
}

if ($Check) {
    Write-Host "   Run without -Check to apply update." -ForegroundColor DarkGray
    exit 0
}

# ─── Step 5: Copy ───────────────────────────────────────────────────────────

Write-Host "📦 Installing to $ExtensionTarget ..." -ForegroundColor Cyan

if (Test-Path $ExtensionTarget) {
    Remove-Item -Recurse -Force $ExtensionTarget
}

Copy-Item -Recurse $ExtensionSource $ExtensionTarget -Force

# ─── Step 6: Write version file ─────────────────────────────────────────────

Write-VersionFile -Checksum $sourceChecksum -TargetPath $ExtensionTarget

# ─── Done ────────────────────────────────────────────────────────────────────

Write-Host "✅ Security council updated (checksum: $($sourceChecksum.Substring(0,12))...)" -ForegroundColor Green
Write-Host "   Restart Copilot CLI to pick up changes." -ForegroundColor DarkGray

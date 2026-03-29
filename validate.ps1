# Copilot CLI Knowledge Agents - Validation Script
# Checks that all config references point to real files and reports issues.
#
# Usage:
#   .\validate.ps1              # Run all checks
#   .\validate.ps1 -Verbose     # Show passed checks too
#
# Exit codes: 0 = all passed, 1 = errors found

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# --- Config ------------------------------------------------------------------

$ExtensionRoot = Join-Path $PSScriptRoot ".github\extensions\security"
$ConfigPath = Join-Path $ExtensionRoot "config.json"

# --- Collect all issues ------------------------------------------------------

$errors = @()
$warnings = @()
$passed = 0

function Add-Check {
    param([string]$Name, [bool]$Ok, [string]$Detail)
    if ($Ok) {
        $script:passed++
        Write-Verbose "  [PASS] $Name"
    } else {
        $script:errors += "  [FAIL] $Name - $Detail"
    }
}

function Add-Warning {
    param([string]$Name, [string]$Detail)
    $script:warnings += "  [WARN] $Name - $Detail"
}

# --- Check 1: config.json exists and is valid JSON --------------------------

Write-Host "Validating config.json..." -ForegroundColor Cyan

Add-Check -Name "config.json exists" -Ok (Test-Path $ConfigPath) -Detail "Expected at: $ConfigPath"

if (-not (Test-Path $ConfigPath)) {
    Write-Host "`n Cannot continue - config.json not found." -ForegroundColor Red
    exit 1
}

$config = $null
try {
    $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    Add-Check -Name "config.json is valid JSON" -Ok $true -Detail ""
} catch {
    Add-Check -Name "config.json is valid JSON" -Ok $false -Detail $_.Exception.Message
    Write-Host "`n Cannot continue - config.json has invalid JSON." -ForegroundColor Red
    exit 1
}

# --- Check 2: All checklist files exist -------------------------------------

Write-Host "Validating checklist files..." -ForegroundColor Cyan

$checklistDetection = $config.checklistDetection
if ($null -eq $checklistDetection) {
    Add-Check -Name "checklistDetection section exists" -Ok $false -Detail "Missing from config.json"
} else {
    Add-Check -Name "checklistDetection section exists" -Ok $true -Detail ""
    
    foreach ($prop in $checklistDetection.PSObject.Properties) {
        $key = $prop.Name
        $filePath = Join-Path $ExtensionRoot $prop.Value.file
        $exists = Test-Path $filePath
        Add-Check -Name "Checklist '$key' file exists ($($prop.Value.file))" -Ok $exists -Detail "Missing: $filePath"
        
        if ($exists) {
            $lineCount = (Get-Content $filePath | Measure-Object -Line).Lines
            if ($null -eq $lineCount) {
                $lineCount = 0
            }
            if ($lineCount -lt 3) {
                Add-Warning -Name "Checklist '$key'" -Detail "Only $lineCount lines - may be incomplete"
            }
        }

        # Check triggers are defined (except general which has none)
        $triggers = $prop.Value.triggers
        if ($key -ne "general" -and ($null -eq $triggers -or $triggers.Count -eq 0)) {
            Add-Warning -Name "Checklist '$key' triggers" -Detail "No trigger keywords defined - won't auto-detect"
        }
    }
}

# --- Check 3: All prompt files exist ----------------------------------------

Write-Host "Validating prompt files..." -ForegroundColor Cyan

$promptsDir = Join-Path $ExtensionRoot "prompts"
$promptDetection = @("architect.md", "attacker.md", "auditor.md", "cross-review.md")

foreach ($prompt in $promptDetection) {
    $filePath = Join-Path $promptsDir $prompt
    $exists = Test-Path $filePath -PathType Leaf
    if ($exists) {
        Add-Check -Name "Prompt '$prompt' file exists" -Ok $true -Detail $filePath
        $lineCount = (Get-Content $filePath | Measure-Object -Line).Lines
        if ($null -eq $lineCount) {
            $lineCount = 0
        }
        if ($lineCount -lt 10) {
            Add-Warning -Name "Prompt '$prompt'" -Detail "Only $lineCount lines - may be incomplete"
        }
    } else {
        Add-Check -Name "Prompt '$prompt' file exists" -Ok $false -Detail "Missing: $filePath"
    }
}

# --- Check 4: No duplicate trigger keywords across checklists ---------------

Write-Host "Checking for duplicate triggers..." -ForegroundColor Cyan

$triggerMap = @{}

foreach ($prop in $checklistDetection.PSObject.Properties) {
    $triggers = @($prop.Value.triggers)
    foreach ($keyword in $triggers) {
        if ($triggerMap.ContainsKey($keyword)) {
            $duplicate = $triggerMap[$keyword]
            Add-Warning -Name "Trigger '$keyword'" -Detail "Trigger keyword is duplicated across '$duplicate' and '$($prop.Name)'"
        } else {
            $triggerMap.Add($keyword, $prop.Name)
        }
    }
}

# --- Check 5: extension.mjs exists ------------------------------------------

Write-Host "Validating extension..." -ForegroundColor Cyan

$extensionPath = Join-Path $ExtensionRoot "extension.mjs"
Add-Check -Name "extension.mjs exists" -Ok (Test-Path $extensionPath) -Detail "Missing: $extensionPath"

# --- Report ------------------------------------------------------------------

Write-Host ""
Write-Host "--- Validation Report ---" -ForegroundColor White

if ($passed -gt 0) {
    Write-Host "  [PASS] $passed checks passed" -ForegroundColor Green
}

if ($warnings.Count -gt 0) {
    Write-Host "  [WARN] $($warnings.Count) warnings:" -ForegroundColor Yellow
    $warnings | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
}

if ($errors.Count -gt 0) {
    Write-Host "  [FAIL] $($errors.Count) errors:" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    Write-Host ""
    Write-Host "Fix the errors above and re-run validate.ps1" -ForegroundColor Red
    exit 1
} else {
    Write-Host ""
    Write-Host "[PASS] All checks passed." -ForegroundColor Green
    exit 0
}

<#
.SYNOPSIS
    Syncs all Copilot CLI agents from Anthropic knowledge-work-plugins.

.DESCRIPTION
    Single script that reads agents-config.json and regenerates all .agent.md
    files from the Anthropic source. Run this after pulling updates from Anthropic.

    Workflow:
    1. cd anthropic-plugins && git pull
    2. cd ../scripts && .\Sync-Agents.ps1

.PARAMETER ConfigPath
    Path to agents-config.json. Defaults to ./agents-config.json

.PARAMETER WhatIf
    Preview changes without writing files

.PARAMETER Force
    Overwrite existing agent files without prompting

.EXAMPLE
    .\Sync-Agents.ps1
    
.EXAMPLE
    .\Sync-Agents.ps1 -WhatIf

.EXAMPLE
    .\Sync-Agents.ps1 -Force -Verbose

.NOTES
    Version: 2.0.0
    Author: Community Contributors
    License: Apache-2.0 (source plugins), MIT (this script)
    Source: https://github.com/anthropics/anthropic-quickstarts/tree/main/knowledge-work-plugins
    
    Changelog:
    2.1.0 - Added intro section with command/skill summary for better "who are you" responses
    2.0.2 - Convert YAML metadata to markdown (emoji headers, descriptions, usage hints)
    2.0.1 - Fixed: Strip inner YAML frontmatter from commands and skills
    2.0.0 - Merged Convert-AnthropicPlugin.ps1 and Convert-AllPlugins.ps1 into single script
    1.2.0 - Added source git commit tracking in YAML frontmatter
    1.1.0 - Fixed header normalization and slash command removal
    1.0.0 - Initial release
#>

#Requires -Version 5.1

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(HelpMessage = "Path to agents-config.json")]
    [ValidateScript({ Test-Path $_ -PathType Leaf })]
    [string]$ConfigPath = (Join-Path $PSScriptRoot "agents-config.json"),

    [Parameter(HelpMessage = "Overwrite existing files without prompting")]
    [switch]$Force
)

$Script:Version = "2.1.0"
$Script:ExitCode = 0
$Script:SuccessCount = 0
$Script:FailCount = 0

# ==============================================================================
# LOGGING
# ==============================================================================

function Write-Step {
    param([string]$Message)
    Write-Host "[+] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[✓] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[!] $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "[✗] $Message" -ForegroundColor Red
}

function Write-Detail {
    param([string]$Message)
    Write-Verbose "    $Message"
}

# ==============================================================================
# SOURCE METADATA
# ==============================================================================

function Get-SourceMetadata {
    <#
    .SYNOPSIS
        Gets git commit info from the Anthropic source repository
    #>
    param([string]$SourcePath)

    $result = [PSCustomObject]@{
        CommitHash  = $null
        CommitShort = $null
        CommitDate  = $null
        Generated   = (Get-Date -Format "yyyy-MM-dd")
    }

    $gitDir = Join-Path $SourcePath ".git"
    if (-not (Test-Path $gitDir)) {
        Write-Warn "Source is not a git repository - skipping commit tracking"
        return $result
    }

    try {
        Push-Location $SourcePath
        
        $hash = git rev-parse HEAD 2>$null
        if ($LASTEXITCODE -eq 0 -and $hash) {
            $result.CommitHash = $hash.Trim()
            $result.CommitShort = $hash.Trim().Substring(0, 7)
        }

        $date = git log -1 --format=%ci 2>$null
        if ($LASTEXITCODE -eq 0 -and $date) {
            $result.CommitDate = ($date.Trim() -split ' ')[0]
        }
    }
    catch {
        Write-Warn "Failed to get git info: $_"
    }
    finally {
        Pop-Location
    }

    return $result
}

# ==============================================================================
# PLUGIN PROCESSING
# ==============================================================================

function Get-PluginMetadata {
    <#
    .SYNOPSIS
        Extracts name and description from plugin.json
    #>
    param([string]$PluginPath)

    $pluginJsonPath = Join-Path $PluginPath ".claude-plugin\plugin.json"
    
    if (-not (Test-Path $pluginJsonPath)) {
        Write-Err "Missing plugin.json: $pluginJsonPath"
        return $null
    }

    try {
        $json = Get-Content -Path $pluginJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
        return [PSCustomObject]@{
            Name        = $json.name
            Description = $json.description
        }
    }
    catch {
        Write-Err "Failed to parse plugin.json: $_"
        return $null
    }
}

function Get-CommandsContent {
    <#
    .SYNOPSIS
        Reads and concatenates all command markdown files
    .OUTPUTS
        PSCustomObject with Content (string) and Summary (array of {Name, Description})
    #>
    param([string]$PluginPath)

    $commandsPath = Join-Path $PluginPath "commands"
    
    if (-not (Test-Path $commandsPath -PathType Container)) {
        return [PSCustomObject]@{ Content = ""; Summary = @() }
    }

    $cmdFiles = Get-ChildItem -Path $commandsPath -Filter "*.md" -File | Sort-Object Name
    
    if ($cmdFiles.Count -eq 0) {
        return [PSCustomObject]@{ Content = ""; Summary = @() }
    }

    $content = @()
    $summary = @()
    $content += ""
    $content += "# Commands"
    $content += ""

    foreach ($file in $cmdFiles) {
        Write-Detail "Reading command: $($file.Name)"
        
        $fileContent = Get-Content -Path $file.FullName -Raw -Encoding UTF8
        
        # Normalize line endings
        $fileContent = $fileContent -replace "`r`n", "`n"
        
        # Extract command name from filename (e.g., "write-spec.md" → "write-spec")
        $cmdName = $file.BaseName
        
        # Extract metadata from YAML frontmatter before stripping
        $description = ""
        $argHint = ""
        if ($fileContent -match '^---\n([\s\S]*?)\n---') {
            $yaml = $Matches[1]
            if ($yaml -match 'description:\s*(.+)') {
                $description = $Matches[1].Trim()
            }
            if ($yaml -match 'argument-hint:\s*[''"]?([^''"]+)[''"]?') {
                $argHint = $Matches[1].Trim()
            }
        }
        
        # Add to summary
        $summary += [PSCustomObject]@{ Name = $cmdName; Description = $description }
        
        # Strip inner YAML frontmatter
        $fileContent = $fileContent -replace '^---\n[\s\S]*?\n---\n*', ''
        
        # Build command header with metadata
        $cmdHeader = "## 📋 $cmdName"
        if ($description) {
            $cmdHeader += "`n`n> **$description**"
        }
        if ($argHint) {
            $cmdHeader += "`n>`n> Usage: ``$cmdName $argHint``"
        }
        
        # Normalize headers: "# /command" → "### command", "# Title" → "### Title" (demote further since we added H2)
        $fileContent = $fileContent -replace '(?m)^# /(.+)$', ''  # Remove duplicate header
        $fileContent = $fileContent -replace '(?m)^# ([^#].*)$', ''  # Remove duplicate title
        $fileContent = $fileContent.Trim()
        
        # Remove slash from /command usage examples
        $fileContent = $fileContent -replace '(?m)^/([a-z][-a-z]+)(\s+\$ARGUMENTS)?$', '$1$2'
        
        $content += $cmdHeader
        $content += ""
        $content += $fileContent
        $content += ""
        $content += "---"
        $content += ""
    }

    return [PSCustomObject]@{ 
        Content = ($content -join "`n")
        Summary = $summary
    }
}

function Get-SkillsContent {
    <#
    .SYNOPSIS
        Reads and concatenates all SKILL.md files
    .OUTPUTS
        PSCustomObject with Content (string) and Summary (array of {Name, Description})
    #>
    param([string]$PluginPath)

    $skillsPath = Join-Path $PluginPath "skills"
    
    if (-not (Test-Path $skillsPath -PathType Container)) {
        return [PSCustomObject]@{ Content = ""; Summary = @() }
    }

    $skillFolders = Get-ChildItem -Path $skillsPath -Directory | Sort-Object Name
    
    if ($skillFolders.Count -eq 0) {
        return [PSCustomObject]@{ Content = ""; Summary = @() }
    }

    $content = @()
    $summary = @()
    $content += ""
    $content += "# Skills"
    $content += ""

    foreach ($folder in $skillFolders) {
        $skillFile = Join-Path $folder.FullName "SKILL.md"
        
        if (Test-Path $skillFile) {
            Write-Detail "Reading skill: $($folder.Name)"
            
            $fileContent = Get-Content -Path $skillFile -Raw -Encoding UTF8
            
            # Normalize line endings
            $fileContent = $fileContent -replace "`r`n", "`n"
            
            # Extract skill name and description from YAML frontmatter
            $skillName = $folder.Name
            $description = ""
            if ($fileContent -match '^---\n([\s\S]*?)\n---') {
                $yaml = $Matches[1]
                if ($yaml -match 'name:\s*(.+)') {
                    $skillName = $Matches[1].Trim()
                }
                if ($yaml -match 'description:\s*(.+)') {
                    $description = $Matches[1].Trim()
                }
            }
            
            # Add to summary
            $summary += [PSCustomObject]@{ Name = $skillName; Description = $description }
            
            # Strip inner YAML frontmatter
            $fileContent = $fileContent -replace '^---\n[\s\S]*?\n---\n*', ''
            
            # Build skill header with metadata
            $skillHeader = "## 🧠 $skillName"
            if ($description) {
                $skillHeader += "`n`n> $description"
            }
            
            # Remove original H1 header (we're replacing it)
            $fileContent = $fileContent -replace '(?m)^# [^\n]+\n*', ''
            $fileContent = $fileContent.Trim()
            
            $content += $skillHeader
            $content += ""
            $content += $fileContent
            $content += ""
            $content += "---"
            $content += ""
        }
    }

    return [PSCustomObject]@{
        Content = ($content -join "`n")
        Summary = $summary
    }
}

function Build-IntroSection {
    <#
    .SYNOPSIS
        Builds an introduction section with command and skill summaries
    #>
    param(
        [string]$AgentName,
        [array]$Commands,
        [array]$Skills
    )

    $intro = @()
    $intro += "# $AgentName Agent"
    $intro += ""
    $intro += "When asked who you are or what you can do, present yourself using this exact format:"
    $intro += ""
    $intro += "---"
    $intro += ""
    $intro += "I'm the **$AgentName** agent. Here's what I can help you with:"
    $intro += ""
    
    if ($Commands.Count -gt 0) {
        $intro += "## 📋 Commands"
        $intro += ""
        foreach ($cmd in $Commands) {
            $intro += "- **$($cmd.Name)** — $($cmd.Description)"
        }
        $intro += ""
    }
    
    if ($Skills.Count -gt 0) {
        $intro += "## 🧠 Skills"
        $intro += ""
        foreach ($skill in $Skills) {
            $intro += "- **$($skill.Name)** — $($skill.Description)"
        }
        $intro += ""
    }
    
    $intro += "---"
    $intro += ""
    $intro += "Just ask me to run any command or use my skills!"
    $intro += ""

    return ($intro -join "`n")
}

function Convert-Plugin {
    <#
    .SYNOPSIS
        Converts a single Anthropic plugin to a Copilot CLI agent file
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [Parameter(Mandatory)]
        [string]$PluginName,

        [Parameter(Mandatory)]
        [string]$SourcePath,

        [Parameter(Mandatory)]
        [string]$OutputPath,

        [Parameter(Mandatory)]
        [PSCustomObject]$SourceMeta,

        [switch]$Force
    )

    $pluginPath = Join-Path $SourcePath $PluginName

    # Validate plugin exists
    if (-not (Test-Path $pluginPath -PathType Container)) {
        Write-Err "Plugin folder not found: $pluginPath"
        return $false
    }

    # Get metadata
    $metadata = Get-PluginMetadata -PluginPath $pluginPath
    if (-not $metadata) {
        return $false
    }

    Write-Detail "Name: $($metadata.Name)"

    # Read content
    $commandsResult = Get-CommandsContent -PluginPath $pluginPath
    $skillsResult = Get-SkillsContent -PluginPath $pluginPath
    
    # Build intro section with command/skill summary
    $intro = Build-IntroSection -AgentName $metadata.Name -Commands $commandsResult.Summary -Skills $skillsResult.Summary

    # Build source tracking
    $sourceInfo = ""
    if ($SourceMeta.CommitHash) {
        $sourceInfo = @"

# Source: anthropic/knowledge-work-plugins
# Commit: $($SourceMeta.CommitHash)
# CommitDate: $($SourceMeta.CommitDate)
# Generated: $($SourceMeta.Generated)
"@
    }
    else {
        $sourceInfo = "`n# Generated: $($SourceMeta.Generated)"
    }

    # Build final content
    $frontmatter = @"
---
name: $($metadata.Name)
description: $($metadata.Description)$sourceInfo
---
"@

    $fullContent = @($frontmatter, "", $intro, $commandsResult.Content, $skillsResult.Content) -join "`n"
    $finalContent = $fullContent.Trim()

    # Ensure output directory exists
    if (-not (Test-Path $OutputPath -PathType Container)) {
        if ($PSCmdlet.ShouldProcess($OutputPath, "Create directory")) {
            New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
        }
    }

    # Write file
    $outputFile = Join-Path $OutputPath "$($metadata.Name).agent.md"

    if ((Test-Path $outputFile) -and -not $Force -and -not $WhatIfPreference) {
        Write-Warn "File exists, skipping (use -Force to overwrite): $outputFile"
        return $false
    }

    if ($PSCmdlet.ShouldProcess($outputFile, "Create agent file")) {
        $Utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($outputFile, $finalContent, $Utf8NoBom)
        
        $fileSize = (Get-Item $outputFile).Length
        Write-Success "$($metadata.Name).agent.md ($fileSize bytes)"
        return $true
    }

    return $false
}

# ==============================================================================
# MAIN
# ==============================================================================

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║  Sync-Agents v$($Script:Version)                                        ║" -ForegroundColor Magenta
Write-Host "║  Anthropic Plugins → Copilot CLI Agents                      ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# Read config
try {
    $config = Get-Content -Path $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Write-Step "Loaded config: $ConfigPath"
}
catch {
    Write-Err "Failed to read config: $_"
    exit 1
}

# Resolve paths
$sourcePath = Join-Path $PSScriptRoot $config.sourcePath
$outputPath = Join-Path $PSScriptRoot $config.outputPath

if (-not (Test-Path $sourcePath)) {
    Write-Err "Source path not found: $sourcePath"
    Write-Host ""
    Write-Host "  Run this first:" -ForegroundColor Yellow
    Write-Host "  git clone https://github.com/anthropics/anthropic-quickstarts.git anthropic-plugins" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# Get source git metadata (once for all agents)
$sourceMeta = Get-SourceMetadata -SourcePath $sourcePath

if ($sourceMeta.CommitShort) {
    Write-Step "Source commit: $($sourceMeta.CommitShort) ($($sourceMeta.CommitDate))"
}

# Filter enabled agents
$enabledAgents = $config.agents | Where-Object { $_.enabled -eq $true }
$totalCount = $enabledAgents.Count

Write-Step "Converting $totalCount agent(s)..."
Write-Host ""

if ($WhatIfPreference) {
    Write-Warn "DRY RUN - No files will be written"
    Write-Host ""
}

# Process each plugin
foreach ($agent in $enabledAgents) {
    $pluginName = $agent.plugin
    
    $result = Convert-Plugin `
        -PluginName $pluginName `
        -SourcePath $sourcePath `
        -OutputPath $outputPath `
        -SourceMeta $sourceMeta `
        -Force:$Force

    if ($result) {
        $Script:SuccessCount++
    }
    else {
        $Script:FailCount++
    }
}

# Summary
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "  Done: $($Script:SuccessCount)/$totalCount agents synced" -ForegroundColor $(if ($Script:FailCount -eq 0) { "Green" } else { "Yellow" })

if ($Script:FailCount -gt 0) {
    Write-Host "  Failed: $($Script:FailCount)" -ForegroundColor Red
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""

if ($Script:FailCount -gt 0) {
    exit 1
}

exit 0

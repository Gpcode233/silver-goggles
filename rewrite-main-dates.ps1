$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

$sourceRef = "backup/main-before-date-rewrite"
$originalMain = (git rev-parse main).Trim()
$backupBranch = "backup/main-before-date-rewrite"
$rewriteBranch = "rewrite/main-dates"

function BranchExists([string]$branchName) {
  git show-ref --verify --quiet "refs/heads/$branchName"
  return $LASTEXITCODE -eq 0
}

if (-not (BranchExists $backupBranch)) {
  git branch $backupBranch $originalMain | Out-Null
}

git checkout main | Out-Null

if (BranchExists $rewriteBranch) {
  git branch -D $rewriteBranch | Out-Null
}

$commits = @(git rev-list --reverse $sourceRef)
if ($commits.Count -eq 0) {
  throw "No commits found on main."
}

$base = [datetimeoffset]::Parse("2026-03-23T09:00:00+01:00")

function Get-CommitMeta([string]$sha) {
  $authorName = (git show -s --format=%an $sha).Trim()
  $authorEmail = (git show -s --format=%ae $sha).Trim()
  $subject = (git show -s --format=%s $sha)
  $body = git show -s --format=%b $sha
  return @{
    Author = "$authorName <$authorEmail>"
    Message = if ([string]::IsNullOrEmpty($body)) { $subject } else { "$subject`n`n$body" }
  }
}

function New-DatedCommit([string]$sha, [string]$date) {
  $meta = Get-CommitMeta $sha
  $env:GIT_AUTHOR_DATE = $date
  $env:GIT_COMMITTER_DATE = $date
  $author = $meta["Author"]
  $messagePath = Join-Path $repoRoot ".git-commit-message.txt"
  Set-Content -Path $messagePath -Value $meta["Message"] -Encoding Ascii
  git commit "--file=$messagePath" "--author=$author" "--date=$date" | Out-Null
  Remove-Item $messagePath -Force
  Remove-Item Env:GIT_AUTHOR_DATE -ErrorAction SilentlyContinue
  Remove-Item Env:GIT_COMMITTER_DATE -ErrorAction SilentlyContinue
}

$first = $commits[0]
git checkout --orphan $rewriteBranch | Out-Null
git rm -rf . --ignore-unmatch | Out-Null
git checkout $first -- . | Out-Null
New-DatedCommit $first ($base.ToString("yyyy-MM-ddTHH:mm:sszzz"))

for ($i = 1; $i -lt $commits.Count; $i++) {
  $sha = $commits[$i]
  $date = $base.AddHours($i).ToString("yyyy-MM-ddTHH:mm:sszzz")
  git cherry-pick --no-commit $sha | Out-Null
  New-DatedCommit $sha $date
}

git checkout main | Out-Null
git reset --hard $rewriteBranch | Out-Null
Write-Output "Rewrote main from $originalMain to $(git rev-parse main)"

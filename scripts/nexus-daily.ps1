# Daily Nexus catalogue run, invoked by Windows Task Scheduler.
#
# Pulls the latest repo state, crawls within the API quota, refreshes the
# enrichment report, and pushes whatever changed. The crawler is resumable and
# quota-aware, so running this more than once a day is wasteless but harmless.
#
# Logs to volo-nexus-daily.log in the user's temp directory.

$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $repo

$log = Join-Path $env:TEMP 'volo-nexus-daily.log'
"=== run started $(Get-Date -Format s) ===" | Add-Content $log

git pull --rebase --quiet 2>&1 | Add-Content $log
node scripts/crawl-nexus.mjs 2>&1 | Add-Content $log
node scripts/crawl-requirements.mjs 2>&1 | Add-Content $log
node scripts/enrich-from-nexus.mjs 2>&1 | Add-Content $log

git add nexus 2>&1 | Add-Content $log
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  git commit -m "Update the Nexus catalogue" 2>&1 | Add-Content $log
  git push --quiet 2>&1 | Add-Content $log
  "pushed catalogue update" | Add-Content $log
} else {
  "no catalogue changes" | Add-Content $log
}

"=== run finished $(Get-Date -Format s) ===" | Add-Content $log

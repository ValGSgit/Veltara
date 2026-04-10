$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$CertDir = Join-Path $RootDir 'certs'
$CertFile = Join-Path $CertDir 'localhost.pem'
$KeyFile = Join-Path $CertDir 'localhost-key.pem'

New-Item -ItemType Directory -Force -Path $CertDir | Out-Null

if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
  Write-Error 'mkcert is not installed. Install from https://github.com/FiloSottile/mkcert'
}

mkcert -install
mkcert -cert-file $CertFile -key-file $KeyFile localhost 127.0.0.1 ::1 workers web portal

Write-Host 'Generated certificates:'
Write-Host "  $CertFile"
Write-Host "  $KeyFile"

# Мини-сервер статики для локального тестирования
param(
    [string]$Root = "C:\Users\Elizaveta\Downloads\koenig-game",
    [int]$Port = 8760
)
$ErrorActionPreference = 'Stop'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Host "Serving $Root at http://127.0.0.1:$Port/"
$mime = @{
    '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'
    '.js'='application/javascript; charset=utf-8'; '.json'='application/json; charset=utf-8'
    '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'; '.ico'='image/x-icon'
}
try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $path = $ctx.Request.Url.AbsolutePath
        if ($path -eq '/') { $path = '/index.html' }
        $file = Join-Path $Root ($path -replace '/', '\')
        try {
            if ((Test-Path $file -PathType Leaf) -and ((Resolve-Path $file).Path.StartsWith($Root))) {
                $ext = [System.IO.Path]::GetExtension($file).ToLower()
                $type = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
                $bytes = [System.IO.File]::ReadAllBytes($file)
                $ctx.Response.ContentType = $type
                $ctx.Response.ContentLength64 = $bytes.Length
                $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $ctx.Response.StatusCode = 404
            }
        } catch { $ctx.Response.StatusCode = 500 }
        $ctx.Response.OutputStream.Close()
    }
} finally { $listener.Stop() }

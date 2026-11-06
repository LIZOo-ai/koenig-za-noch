# Парсер CSV с объявлениями Avito -> data\listings.js + data\listings.json
param(
    [Parameter(Mandatory=$true)][string]$CsvPath,
    [Parameter(Mandatory=$true)][string]$OutDir
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$colUrl      = 'sliderLink-d5107317afba0dec href'
$photoCols   = @('image-_5928ad20c08a425b src','image-_5928ad20c08a425b src 2','image-_5928ad20c08a425b src 3','image-_5928ad20c08a425b src 4','image-_5928ad20c08a425b src 5')
$colTitle    = 'root-_3be970cbe47adb45'
$colRating   = 'size_m-_05800d40521e2e33'
$colReviews  = 'root-affa583e50031066'
$colPrice    = 'size_l-_05800d40521e2e33'
$colSuper    = 'content-_9d9763f6d1ada1d0'
$colInstant  = 'content-_9d9763f6d1ada1d0 2'
$colAddress  = 'root-affa583e50031066 2'
$colSeller   = 'root-affa583e50031066 4'

function Parse-Price($text) {
    if (-not $text) { return $null }
    $d = ($text -replace '\D','')
    if ($d) { return [int]$d } else { return $null }
}

function Parse-Rating($text) {
    if (-not $text) { return $null }
    $v = 0.0
    if ([double]::TryParse(($text -replace ',','.'), [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$v)) {
        if ($v -gt 0 -and $v -le 5) { return [math]::Round($v,1) }
    }
    return $null
}

function Parse-Reviews($text) {
    if (-not $text) { return $null }
    $d = ($text -replace '\D','')
    if ($d) { return [int]$d } else { return $null }
}

function Parse-Title($text) {
    $type = $null; $area = $null; $beds = $null
    if ($text) {
        $t = $text.Trim()
        $type = ($t -split ',')[0].Trim()
        if ($t -match '([\d.,]+)\s*м') {
            $a = ($Matches[1] -replace ',','.').TrimEnd('.')
            $area = [double]::Parse($a, [System.Globalization.CultureInfo]::InvariantCulture)
        }
        if ($t -match '(\d+)\s*кроват') { $beds = [int]$Matches[1] }
    }
    return @($type, $area, $beds)
}

$rows = @()
$raw = Import-Csv -Path $CsvPath -Encoding UTF8
Write-Host ("Строк в CSV: " + $raw.Count)

foreach ($r in $raw) {
    $url = ''
    if ($r.$colUrl) { $url = $r.$colUrl.Trim() }
    $price = Parse-Price $r.$colPrice
    if (-not $url -or -not $price) { continue }
    $photos = @()
    foreach ($c in $photoCols) {
        $p = $r.$c
        if ($p) { $p = $p.Trim() }
        if ($p -and ($photos -notcontains $p)) { $photos += $p }
    }
    $t = Parse-Title $r.$colTitle
    $super = $false
    if ($r.$colSuper -and $r.$colSuper.ToLower().Contains('суперхозяин')) { $super = $true }
    $instant = $false
    if ($r.$colInstant -and $r.$colInstant.ToLower().Contains('бронь')) { $instant = $true }
    $rows += [ordered]@{
        listingUrl = $url
        price      = $price
        photos     = $photos
        title      = if ($r.$colTitle) { $r.$colTitle.Trim() } else { '' }
        type       = $t[0]
        area       = $t[1]
        beds       = $t[2]
        rating     = Parse-Rating $r.$colRating
        reviews    = Parse-Reviews $r.$colReviews
        superhost  = $super
        instant    = $instant
        address    = if ($r.$colAddress) { $r.$colAddress.Trim() } else { '' }
        seller     = if ($r.$colSeller) { $r.$colSeller.Trim() } else { '' }
    }
}

$rows = @($rows | Sort-Object { $_.price })
for ($i = 0; $i -lt $rows.Count; $i++) { $rows[$i].id = "apt-{0:d2}" -f ($i + 1) }

$prices = @($rows | ForEach-Object { $_.price })
$n = $prices.Count
$mean = [math]::Round(($prices | Measure-Object -Average).Average)
$median = if ($n % 2 -eq 1) { $prices[[int][math]::Floor($n/2)] } else { [math]::Round(($prices[$n/2-1] + $prices[$n/2]) / 2) }
Write-Host ("Объявлений: $n")
Write-Host ("Мин: " + ($prices | Measure-Object -Minimum).Minimum + "  Макс: " + ($prices | Measure-Object -Maximum).Maximum + "  Средняя: $mean  Медиана: $median")
Write-Host ("Без фото: " + @($rows | Where-Object { $_.photos.Count -eq 0 }).Count)
Write-Host ("Без адреса: " + @($rows | Where-Object { -not $_.address }).Count)
Write-Host ("Без рейтинга: " + @($rows | Where-Object { $null -eq $_.rating }).Count)

$json = ConvertTo-Json @($rows) -Depth 4
$jsonPath = Join-Path $OutDir 'listings.json'
[System.IO.File]::WriteAllText($jsonPath, $json, (New-Object System.Text.UTF8Encoding($false)))

$compact = ConvertTo-Json @($rows) -Depth 4 -Compress
$js = "// Сгенерировано из CSV (реальные объявления Avito, Калининград).`n"
$js += "// Условия цен: 1 ночь, 2 гостя, 14-15 ноября 2026.`n"
$js += "window.LISTINGS = " + $compact + ";`n"
$jsPath = Join-Path $OutDir 'listings.js'
[System.IO.File]::WriteAllText($jsPath, $js, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "OK -> $OutDir"

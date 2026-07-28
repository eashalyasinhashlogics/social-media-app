$baseUrl = "http://localhost:8000/api/v1"

# ---- Create/login User A ----
$userABody = @{
    username = "testUserA"
    email    = "testusera@example.com"
    password = "TestPass123!"
} | ConvertTo-Json

try {
    $regA = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -ContentType "application/json" -Body $userABody
    Write-Host "User A registered." -ForegroundColor Green
} catch {
    Write-Host "User A registration failed (maybe already exists) - trying login instead" -ForegroundColor Yellow
}

$loginABody = @{
    username = "testUserA"
    password = "TestPass123!"
} | ConvertTo-Json
$loginA = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginABody
$userAToken = $loginA.access_token

# ---- Create/login User B ----
$userBBody = @{
    username = "testUserB"
    email    = "testuserb@example.com"
    password = "TestPass123!"
} | ConvertTo-Json

try {
    $regB = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -ContentType "application/json" -Body $userBBody
    Write-Host "User B registered." -ForegroundColor Green
} catch {
    Write-Host "User B registration failed (maybe already exists) - trying login instead" -ForegroundColor Yellow
}

$loginBBody = @{
    username = "testUserB"
    password = "TestPass123!"
} | ConvertTo-Json
$loginB = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBBody
$userBToken = $loginB.access_token

Write-Host "`n--- TOKENS ---" -ForegroundColor Cyan
Write-Host "User A token: $userAToken"
Write-Host "User B token: $userBToken"
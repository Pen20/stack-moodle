# Supabase API Testing Script
# Run this script to test all API endpoints and database connections

Write-Host "🧪 Testing Supabase API Connection..." -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3000"

# Test 1: Health Check
Write-Host "`n1. Testing Health Check..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "$baseUrl/" -Method GET
    Write-Host "✅ Health Check: $healthResponse" -ForegroundColor Green
} catch {
    Write-Host "❌ Health Check Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Start Learning Session
Write-Host "`n2. Testing Session Start..." -ForegroundColor Yellow
try {
    $sessionBody = @{
        page_url = "test-page-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        anonymous_id = "test-user-$(Get-Random)"
    } | ConvertTo-Json

    $sessionResponse = Invoke-RestMethod -Uri "$baseUrl/session/start" -Method POST -Headers @{"Content-Type"="application/json"} -Body $sessionBody
    $sessionId = $sessionResponse.session.id
    Write-Host "✅ Session Created: $sessionId" -ForegroundColor Green
} catch {
    Write-Host "❌ Session Start Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 3: Record Question Attempt
Write-Host "`n3. Testing Question Attempt..." -ForegroundColor Yellow
try {
    $attemptBody = @{
        session_id = $sessionId
        question_file = "test-question.xml"
        question_name = "sample_question"
        question_prefix = "q1"
        seed = Get-Random -Maximum 1000
        score = 85
        max_score = 100
        is_correct = $true
    } | ConvertTo-Json

    $attemptResponse = Invoke-RestMethod -Uri "$baseUrl/attempt" -Method POST -Headers @{"Content-Type"="application/json"} -Body $attemptBody
    $attemptId = $attemptResponse.attempt.id
    Write-Host "✅ Question Attempt Recorded: $attemptId" -ForegroundColor Green
} catch {
    Write-Host "❌ Question Attempt Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 4: Track Input
Write-Host "`n4. Testing Input Tracking..." -ForegroundColor Yellow
try {
    $inputBody = @{
        attempt_id = $attemptId
        session_id = $sessionId
        input_name = "answer_field"
        input_value = "42"
        input_type = "number"
        is_final_answer = $true
        validation_result = "correct"
    } | ConvertTo-Json

    $inputResponse = Invoke-RestMethod -Uri "$baseUrl/input" -Method POST -Headers @{"Content-Type"="application/json"} -Body $inputBody
    $inputId = $inputResponse.input.id
    Write-Host "✅ Input Tracked: $inputId" -ForegroundColor Green
} catch {
    Write-Host "❌ Input Tracking Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Summary
Write-Host "`n🎉 All Tests Passed!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Session ID: $sessionId" -ForegroundColor White
Write-Host "Attempt ID: $attemptId" -ForegroundColor White
Write-Host "Input ID: $inputId" -ForegroundColor White
Write-Host "`n✅ Your Supabase database connection is working perfectly!" -ForegroundColor Green

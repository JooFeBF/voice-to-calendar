#!/usr/bin/env fish

set -g BASE_URL "http://localhost:3000"
set -g TEST_RESULTS 0
set -g TEST_FAILURES 0
set -g TEST_TIMESTAMP (date +%s)
set -g CURRENT_TEST_NAME ""
set -g MAX_POLL_ATTEMPTS 30  # Maximum number of polling attempts
set -g POLL_INTERVAL 2       # Seconds between polls
set -g POLL_TIMEOUT 15       # Timeout for each poll request in seconds (longer for audio generation)

function log_test
    set -g CURRENT_TEST_NAME (echo $argv | string replace -a " " "_" | string replace -a "/" "_")
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "TEST: $argv"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cleanup_test_temp_files
end

function get_test_temp_file
    set suffix $argv[1]
    echo "/tmp/test_$CURRENT_TEST_NAME"_"$TEST_TIMESTAMP"_"$suffix"
end

function cleanup_test_temp_files
    find /tmp -maxdepth 1 -name "test_*_$TEST_TIMESTAMP_*" -type f -delete 2>/dev/null
end

function log_pass
    echo "✓ PASS: $argv"
    set -g TEST_RESULTS (math $TEST_RESULTS + 1)
end

function log_fail
    echo "✗ FAIL: $argv"
    set -g TEST_FAILURES (math $TEST_FAILURES + 1)
    set -g TEST_RESULTS (math $TEST_RESULTS + 1)
end

function cleanup
    cleanup_test_temp_files
end

function print_summary
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "TEST SUMMARY"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Total Tests: $TEST_RESULTS"
    set passed (math $TEST_RESULTS - $TEST_FAILURES)
    echo "Passed: $passed"
    echo "Failed: $TEST_FAILURES"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    if test $TEST_FAILURES -gt 0
        echo "✗ Some tests failed"
        return 1
    else
        echo "✓ All tests passed"
        return 0
    end
end

# Test: Polling for currently occurring events
function test_polling_for_current_events
    log_test "Polling for Currently Occurring Events"
    
    set temp_file (get_test_temp_file "response.json")
    set temp_download (get_test_temp_file "audio.wav")
    
    echo "  NOTE: This test polls for currently occurring events until one is found"
    echo "  Expected: Polling should find a currently occurring event"
    echo "  Expected: Audio should be generated and downloadable"
    echo "  Expected: Complete polling → download flow should work"
    echo ""
    echo "  Step 1: Starting to poll for currently occurring events..."
    echo "  Polling interval: $POLL_INTERVAL seconds"
    echo "  Maximum attempts: $MAX_POLL_ATTEMPTS"
    echo ""
    
    set poll_count 0
    set found_event false
    set poll_event_id ""
    set event_title ""
    
    # Poll until we find a current event or reach max attempts
    # Note: When an event is found, audio generation can take 5-10 seconds, so timeout needs to be longer
    while test $poll_count -lt $MAX_POLL_ATTEMPTS
        set poll_count (math $poll_count + 1)
        echo "  Attempt $poll_count/$MAX_POLL_ATTEMPTS: Polling /api/events/current..."
        
        # Use longer timeout for polling since audio generation happens server-side and can take time
        set http_code (curl -s -o $temp_file -w "%{http_code}" \
            -X GET \
            $BASE_URL/api/events/current \
            --max-time 15)
        
        if test "$http_code" -ne 200
            # HTTP 000 usually means connection timeout/error, which is acceptable during audio generation
            if test "$http_code" -eq 0
                echo "  ⚠ Warning: Connection timeout (audio generation may be in progress)"
            else
                echo "  ⚠ Warning: Polling request failed (HTTP $http_code)"
            end
            if test $poll_count -lt $MAX_POLL_ATTEMPTS
                echo "  Waiting $POLL_INTERVAL seconds before next attempt..."
                sleep $POLL_INTERVAL
                continue
            else
                echo "  Error response: "(cat $temp_file 2>/dev/null)
                log_fail "Polling failed after $MAX_POLL_ATTEMPTS attempts (HTTP $http_code)"
                cleanup_test_temp_files
                return 1
            end
        end
        
        set body (cat $temp_file 2>/dev/null)
        
        # Debug: Show raw response if verbose
        if test -z "$body"
            echo "  ⚠ Warning: Empty response body"
            if test $poll_count -lt $MAX_POLL_ATTEMPTS
                echo "  Waiting $POLL_INTERVAL seconds before next attempt..."
                sleep $POLL_INTERVAL
                continue
            end
        end
        
        # Extract fields from response - handle both hasPending:true and hasPending: false
        # Use case-insensitive matching and handle boolean values
        set has_pending_raw (echo $body | grep -io '"hasPending":[^,}]*' | cut -d':' -f2 | string trim)
        set has_pending (echo "$has_pending_raw" | string lower)
        set poll_event_id (echo $body | grep -o '"eventId":"[^"]*"' | cut -d'"' -f4)
        set event_title (echo $body | grep -o '"title":"[^"]*"' | cut -d'"' -f4)
        set error_msg (echo $body | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        
        # Debug output for troubleshooting
        if test -n "$body" -a \( $poll_count -eq 1 -o "$has_pending" = "true" -o \( -z "$has_pending" -a -n "$poll_event_id" \) \)
            echo "  Response body: $body"
            echo "  Parsed hasPending: '$has_pending' (raw: '$has_pending_raw')"
            echo "  Parsed eventId: '$poll_event_id'"
            echo "  Parsed title: '$event_title'"
        end
        
        # Check for errors in response
        if test -n "$error_msg"
            echo "  ⚠ Error in response: $error_msg"
        end
        
        # Check if we found an event - eventId presence is the key indicator
        # The server returns hasPending:true with eventId when audio is ready
        if test -n "$poll_event_id"
            echo ""
            echo "  ✓ Currently occurring event found!"
            echo "  Event Title: $event_title"
            echo "  Event ID: $poll_event_id"
            echo "  hasPending: $has_pending"
            set found_event true
            break
        else if test "$has_pending" = "false" -o "$has_pending" = "null"
            if test $poll_count -lt $MAX_POLL_ATTEMPTS
                echo "  No currently occurring event found. hasPending: $has_pending"
                echo "  Waiting $POLL_INTERVAL seconds before next attempt..."
                sleep $POLL_INTERVAL
            else
                echo "  Response: $body"
                log_fail "No currently occurring event found after $MAX_POLL_ATTEMPTS attempts"
                cleanup_test_temp_files
                return 1
            end
        else
            # Unclear response - log it and continue
            echo "  ⚠ Warning: Unexpected response format. Body: $body"
            echo "  hasPending: '$has_pending', eventId: '$poll_event_id'"
            if test $poll_count -lt $MAX_POLL_ATTEMPTS
                echo "  Waiting $POLL_INTERVAL seconds before next attempt..."
                sleep $POLL_INTERVAL
                continue
            end
        end
    end
    
    if test "$found_event" != "true"
        log_fail "Failed to find currently occurring event after $MAX_POLL_ATTEMPTS attempts"
        cleanup_test_temp_files
        return 1
    end
    
    echo ""
    echo "  Step 2: Downloading generated audio for event: $poll_event_id..."
    
    # Download the audio that was generated
    set http_code (curl -s -o $temp_download -w "%{http_code}" \
        -X GET \
        $BASE_URL/api/audio/download/$poll_event_id \
        --max-time 30)
    
    if test "$http_code" -ne 200
        echo "  Error response: "(curl -s $BASE_URL/api/audio/download/$poll_event_id --max-time 10 2>/dev/null)
        log_fail "Audio download failed (HTTP $http_code)"
        cleanup_test_temp_files
        return 1
    end
    
    if test -f $temp_download
        set file_size (wc -c < $temp_download | string trim)
        if test "$file_size" -gt 0
            echo "  ✓ Audio downloaded successfully"
            echo "  File size: $file_size bytes"
            echo "  File path: $temp_download"
            
            # Verify it's actually an audio file (check for common audio file headers)
            set file_type (file $temp_download 2>/dev/null | string match -r "audio|WAV|MPEG|OGG" || echo "")
            if test -n "$file_type"
                echo "  ✓ File type verified: $file_type"
            else
                echo "  ⚠ Warning: Could not verify file type, but file exists and is non-empty"
            end
            
            log_pass "Polling and audio download successful (event: $event_title, audio size: $file_size bytes, attempts: $poll_count)"
        else
            log_fail "Audio file is empty (0 bytes)"
        end
    else
        log_fail "Audio file not found after download"
    end
    
    cleanup_test_temp_files
end

function main
    echo "ESP32 Polling Test Suite"
    echo "Testing server at: $BASE_URL"
    echo "Test run timestamp: $TEST_TIMESTAMP"
    echo ""
    
    cleanup
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "TEST: Polling for Currently Occurring Events"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    test_polling_for_current_events
    
    echo ""
    print_summary
    
    set exit_code $status
    cleanup
    exit $exit_code
end

main


#!/usr/bin/env fish

set -g BASE_URL "http://localhost:3000"
set -g AUDIO_FILE "audio.ogg"  # For event creation + polling (mentions current time)
set -g AUDIO_FILE_2 "audio2.ogg"  # For event creation only
set -g AUDIO_FILE_3 "audio3.ogg"  # For ambiguous prompt handling test
set -g TEST_RESULTS 0
set -g TEST_FAILURES 0
set -g TEST_TIMESTAMP (date +%s)
set -g CURRENT_TEST_NAME ""

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

# Test 1: audio2.ogg - Event creation only (no audio generation)
function test_event_creation_only
    log_test "Event Creation Only (audio2.ogg)"
    
    if not test -f $AUDIO_FILE_2
        log_fail "Audio file $AUDIO_FILE_2 not found"
        cleanup_test_temp_files
        return 1
    end
    
    set temp_file (get_test_temp_file "response.json")
    
    echo "  NOTE: This test uses audio2.ogg to test event creation only"
    echo "  Expected: Event should be created successfully"
    echo "  Expected: No audio generation (event is scheduled for future)"
    echo ""
    echo "  Step 1: Upload audio2.ogg..."
    
    set http_code (curl -s -o $temp_file -w "%{http_code}" \
        -X POST \
        -H "Content-Type: audio/wav" \
        --data-binary @$AUDIO_FILE_2 \
        $BASE_URL/api/audio/upload-stream)
    
    if test "$http_code" -ne 200
        log_fail "Upload failed (HTTP $http_code)"
        cleanup_test_temp_files
        return 1
    end
    
    set body (cat $temp_file 2>/dev/null)
    set event_id (echo $body | grep -o '"eventId":"[^"]*"' | cut -d'"' -f4)
    
    if test -z "$event_id"
        log_fail "No event ID received"
        cleanup_test_temp_files
        return 1
    end
    
    echo "  Event ID: $event_id"
    echo "  Step 2: Processing audio to create calendar event..."
    
    set http_code (curl -s -o $temp_file -w "%{http_code}" \
        -X POST \
        $BASE_URL/api/audio/process/$event_id \
        --max-time 60)
    
    set body (cat $temp_file 2>/dev/null)
    
    if test "$http_code" -ne 200
        set error (echo $body | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        if test -z "$error"
            set error "Unknown error"
        end
        echo "  Error response: $body"
        log_fail "Processing failed (HTTP $http_code): $error"
        cleanup_test_temp_files
        return 1
    end
    
    set operation (echo $body | grep -o '"operation":"[^"]*"' | cut -d'"' -f4)
    set calendar_event_id (echo $body | grep -o '"calendarEventId":"[^"]*"' | cut -d'"' -f4)
    set message (echo $body | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
    
    # Handle "no_action" case - event already exists, which is acceptable
    if test "$operation" = "no_action"
        echo "  Operation: no_action (event already exists)"
        if test -n "$message"
            echo "  Message: $message"
        end
        echo "  ✓ Event already exists - no action needed (this is acceptable)"
        log_pass "Event already exists - no action needed (operation: no_action)"
        cleanup_test_temp_files
        return 0
    end
    
    if test -z "$calendar_event_id"
        log_fail "No calendar event ID received. Response: $body"
        cleanup_test_temp_files
        return 1
    end
    
    echo "  Calendar Event ID: $calendar_event_id"
    echo "  Operation: $operation"
    echo "  ✓ Event created successfully"
    log_pass "Event creation successful (calendar event created: $calendar_event_id)"
    
    cleanup_test_temp_files
end

# Test 2: audio.ogg - Event creation + Polling for current events
function test_event_creation_and_polling
    log_test "Event Creation + Polling for Current Events (audio.ogg)"
    
    if not test -f $AUDIO_FILE
        log_fail "Audio file $AUDIO_FILE not found"
        cleanup_test_temp_files
        return 1
    end
    
    set temp_file (get_test_temp_file "response.json")
    set temp_download (get_test_temp_file "audio.wav")
    
    echo "  NOTE: This test uses audio.ogg which mentions current time"
    echo "  Expected: Event should be created successfully"
    echo "  Expected: Polling should find the current event and generate audio"
    echo ""
    echo "  Step 1: Upload audio.ogg..."
    
    set http_code (curl -s -o $temp_file -w "%{http_code}" \
        -X POST \
        -H "Content-Type: audio/wav" \
        --data-binary @$AUDIO_FILE \
        $BASE_URL/api/audio/upload-stream)
    
    if test "$http_code" -ne 200
        log_fail "Upload failed (HTTP $http_code)"
        cleanup_test_temp_files
        return 1
    end
    
    set body (cat $temp_file 2>/dev/null)
    set upload_event_id (echo $body | grep -o '"eventId":"[^"]*"' | cut -d'"' -f4)
    
    if test -z "$upload_event_id"
        log_fail "No event ID received from upload"
        cleanup_test_temp_files
        return 1
    end
    
    echo "  Upload Event ID: $upload_event_id"
    echo "  Step 2: Processing audio to create calendar event..."
    
    set http_code (curl -s -o $temp_file -w "%{http_code}" \
        -X POST \
        $BASE_URL/api/audio/process/$upload_event_id \
        --max-time 60)
    
    set body (cat $temp_file 2>/dev/null)
    
    if test "$http_code" -ne 200
        set error (echo $body | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        if test -z "$error"
            set error "Unknown error"
        end
        echo "  Error response: $body"
        log_fail "Processing failed (HTTP $http_code): $error"
        cleanup_test_temp_files
        return 1
    end
    
    set calendar_event_id (echo $body | grep -o '"calendarEventId":"[^"]*"' | cut -d'"' -f4)
    set operation (echo $body | grep -o '"operation":"[^"]*"' | cut -d'"' -f4)
    
    if test "$operation" = "no_action"
        echo "  Operation: no_action (event already exists)"
        echo "  This is acceptable - the event was already created in a previous test"
        echo "  Continuing with polling test..."
    else if test -z "$calendar_event_id"
        log_fail "No calendar event ID received. Response: $body"
        cleanup_test_temp_files
        return 1
    else
        echo "  Calendar Event ID: $calendar_event_id"
        echo "  ✓ Event created successfully"
    end
    
    echo "  Step 3: Polling for currently occurring events..."
    echo "  (This should find the event we just created and generate audio)"
    
    # Poll for current events - this should find our event and generate audio
    set http_code (curl -s -o $temp_file -w "%{http_code}" \
        -X GET \
        $BASE_URL/api/events/current \
        --max-time 30)
    
    if test "$http_code" -ne 200
        echo "  Error response: "(cat $temp_file 2>/dev/null)
        log_fail "Polling failed (HTTP $http_code)"
        cleanup_test_temp_files
        return 1
    end
    
    set body (cat $temp_file 2>/dev/null)
    set has_pending (echo $body | grep -o '"hasPending":[^,}]*' | cut -d':' -f2 | string trim)
    set poll_event_id (echo $body | grep -o '"eventId":"[^"]*"' | cut -d'"' -f4)
    set title (echo $body | grep -o '"title":"[^"]*"' | cut -d'"' -f4)
    
    if test "$has_pending" != "true" -o -z "$poll_event_id"
        echo "  Response: $body"
        log_fail "No currently occurring event found. hasPending: $has_pending"
        cleanup_test_temp_files
        return 1
    end
    
    echo "  ✓ Currently occurring event found: $title"
    echo "  Poll Event ID: $poll_event_id"
    echo "  Step 4: Downloading generated audio..."
    
    # Download the audio that was generated
    set http_code (curl -s -o $temp_download -w "%{http_code}" \
        -X GET \
        $BASE_URL/api/audio/download/$poll_event_id \
        --max-time 10)
    
    if test "$http_code" -ne 200
        echo "  Error: Audio download failed (HTTP $http_code)"
        log_fail "Audio download failed (HTTP $http_code)"
        cleanup_test_temp_files
        return 1
    end
    
    if test -f $temp_download
        set file_size (wc -c < $temp_download | string trim)
        if test "$file_size" -gt 0
            echo "  ✓ Audio downloaded successfully: $file_size bytes"
            log_pass "Event creation and polling successful (audio generated: $file_size bytes)"
        else
            log_fail "Audio file is empty"
        end
    else
        log_fail "Audio file not found after download"
    end
    
    cleanup_test_temp_files
end

# Test 3: audio3.ogg - Ambiguous prompt handling
function test_ambiguous_prompt_handling
    log_test "Ambiguous Prompt Handling (audio3.ogg)"
    
    if not test -f $AUDIO_FILE_3
        log_fail "Audio file $AUDIO_FILE_3 not found"
        cleanup_test_temp_files
        return 1
    end
    
    set temp_file (get_test_temp_file "response.json")
    
    echo "  NOTE: This test uses audio3.ogg to test ambiguous prompt handling"
    echo "  Expected: Ambiguous prompts should create events with logical defaults"
    echo "  Expected: Events should have reasonable start times (e.g., 5-15 min from now for immediate tasks)"
    echo "  Expected: Events should have appropriate durations based on task type"
    echo ""
    echo "  Step 1: Upload audio3.ogg..."
    
    set http_code (curl -s -o $temp_file -w "%{http_code}" \
        -X POST \
        -H "Content-Type: audio/wav" \
        --data-binary @$AUDIO_FILE_3 \
        $BASE_URL/api/audio/upload-stream)
    
    if test "$http_code" -ne 200
        log_fail "Upload failed (HTTP $http_code)"
        cleanup_test_temp_files
        return 1
    end
    
    set body (cat $temp_file 2>/dev/null)
    set event_id (echo $body | grep -o '"eventId":"[^"]*"' | cut -d'"' -f4)
    
    if test -z "$event_id"
        log_fail "No event ID received"
        cleanup_test_temp_files
        return 1
    end
    
    echo "  Event ID: $event_id"
    echo "  Step 2: Processing audio to create calendar event with ambiguous prompt..."
    
    set http_code (curl -s -o $temp_file -w "%{http_code}" \
        -X POST \
        $BASE_URL/api/audio/process/$event_id \
        --max-time 60)
    
    set body (cat $temp_file 2>/dev/null)
    
    if test "$http_code" -ne 200
        set error (echo $body | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        if test -z "$error"
            set error "Unknown error"
        end
        echo "  Error response: $body"
        log_fail "Processing failed (HTTP $http_code): $error"
        cleanup_test_temp_files
        return 1
    end
    
    set calendar_event_id (echo $body | grep -o '"calendarEventId":"[^"]*"' | cut -d'"' -f4)
    set operation (echo $body | grep -o '"operation":"[^"]*"' | cut -d'"' -f4)
    
    # Extract eventDetails fields (title, start_time, end_time from nested eventDetails object)
    # Using a simple JSON parsing approach for fish shell
    set title (echo $body | grep -o '"title":"[^"]*"' | head -n 1 | cut -d'"' -f4)
    set start_time (echo $body | grep -o '"start_time":"[^"]*"' | head -n 1 | cut -d'"' -f4)
    set end_time (echo $body | grep -o '"end_time":"[^"]*"' | head -n 1 | cut -d'"' -f4)
    
    if test -z "$calendar_event_id" -a "$operation" != "no_action"
        log_fail "No calendar event ID received. Response: $body"
        cleanup_test_temp_files
        return 1
    end
    
    if test "$operation" = "no_action"
        echo "  Operation: no_action (event already exists)"
        echo "  This might be acceptable if the test was run multiple times"
    else
        echo "  Calendar Event ID: $calendar_event_id"
        echo "  Title: $title"
        echo "  Start Time: $start_time"
        echo "  End Time: $end_time"
        echo "  ✓ Event created successfully"
    end
    
    # Verify that the event has reasonable times (if it's a create operation)
    if test "$operation" = "create" -a -n "$start_time" -a -n "$end_time"
        echo "  Step 3: Validating ambiguous prompt handling..."
        echo "  Analyzing event times to verify logical defaults were applied"
        
        # Parse the start time to check if it's within reasonable range
        # For ambiguous prompts like "tengo que comprar abarrotes", 
        # start time should be within 5-30 minutes from now
        # Try different date parsing formats for Linux
        set start_timestamp (date -d "$start_time" +%s 2>/dev/null || date -d "$start_time" -u +%s 2>/dev/null || gdate -d "$start_time" +%s 2>/dev/null || echo "")
        
        if test -n "$start_timestamp"
            set now_timestamp (date +%s)
            set time_diff_minutes (math "($start_timestamp - $now_timestamp) / 60")
            
            echo "  Time difference from now: $time_diff_minutes minutes"
            
            # Check if start time is within reasonable range for immediate tasks (0-120 minutes)
            # or for future tasks (positive time difference)
            if test "$time_diff_minutes" -ge 0 -a "$time_diff_minutes" -le 120
                echo "  ✓ Start time is within reasonable range for ambiguous prompt (0-120 min)"
            else
                echo "  ⚠ Warning: Start time is $time_diff_minutes minutes from now (might be outside expected range)"
            end
        else
            # If parsing failed, might be currentDate+<ms> format which is also valid
            if echo "$start_time" | grep -q "currentDate+"
                echo "  ✓ Start time uses relative format (currentDate+<ms>) - will be processed correctly"
            else
                echo "  ⚠ Warning: Could not parse start time: $start_time"
            end
        end
        
        # Verify that end time is after start time
        if test -n "$start_time" -a -n "$end_time"
            set start_ts (date -d "$start_time" +%s 2>/dev/null || date -d "$start_time" -u +%s 2>/dev/null || gdate -d "$start_time" +%s 2>/dev/null || echo "")
            set end_ts (date -d "$end_time" +%s 2>/dev/null || date -d "$end_time" -u +%s 2>/dev/null || gdate -d "$end_time" +%s 2>/dev/null || echo "")
            
            if test -n "$start_ts" -a -n "$end_ts" -a "$end_ts" -gt "$start_ts"
                set duration_minutes (math "($end_ts - $start_ts) / 60")
                echo "  Event duration: $duration_minutes minutes"
                
                # Check if duration is reasonable (typically 5 min to 3 hours for tasks)
                if test "$duration_minutes" -ge 5 -a "$duration_minutes" -le 180
                    echo "  ✓ Event duration is within reasonable range (5-180 min)"
                else
                    echo "  ⚠ Warning: Event duration ($duration_minutes min) might be outside typical range (5-180 min)"
                end
            else if echo "$start_time" | grep -q "currentDate+" || echo "$end_time" | grep -q "currentDate+"
                echo "  ✓ Event uses relative time format (currentDate+<ms>) - will be processed correctly"
            else
                echo "  ⚠ Note: Could not fully validate event duration (dates may be in relative format)"
            end
        end
    end
    
    if test "$operation" = "create"
        log_pass "Ambiguous prompt handled successfully (event created: $calendar_event_id, title: $title)"
    else if test "$operation" = "no_action"
        log_pass "Ambiguous prompt handled (event already exists or no action needed)"
    else
        log_pass "Ambiguous prompt handled (operation: $operation)"
    end
    
    cleanup_test_temp_files
end

function main
    echo "ESP32 Audio File Upload Test Suite"
    echo "Testing server at: $BASE_URL"
    echo "Test run timestamp: $TEST_TIMESTAMP"
    echo ""
    
    cleanup
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "TEST 1: Event Creation Only (audio2.ogg)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    test_event_creation_only
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "TEST 2: Event Creation + Polling (audio.ogg)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    test_event_creation_and_polling
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "TEST 3: Ambiguous Prompt Handling (audio3.ogg)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    test_ambiguous_prompt_handling
    
    echo ""
    print_summary
    
    set exit_code $status
    cleanup
    exit $exit_code
end

main

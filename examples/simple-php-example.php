<?php
/**
 * Simple PHP example to use with your Parallel Port Printer Server
 *
 * Prerequisites:
 * 1. Make sure your Node.js server is running on port 3000
 * 2. Start the server with: node server.js
 */

// Simple function to make requests to the printer server
function callPrinterAPI($endpoint, $data = null, $method = 'GET') {
    $url = 'http://localhost:3000' . $endpoint;

    $options = [
        'http' => [
            'method' => $method,
            'header' => 'Content-Type: application/json',
            'timeout' => 10
        ]
    ];

    if ($data) {
        $options['http']['content'] = json_encode($data);
    }

    $context = stream_context_create($options);
    $response = file_get_contents($url, false, $context);

    return $response ? json_decode($response, true) : false;
}

// Example 1: Print a simple receipt
echo "Printing receipt...\n";

// Print header
callPrinterAPI('/command', [
    'type' => 'printLine',
    'text' => '=== RECEIPT ===',
    'port' => 'LPT2'
], 'POST');

// Print items
callPrinterAPI('/command', [
    'type' => 'printLine',
    'text' => 'Item 1: $10.00',
    'port' => 'LPT2'
], 'POST');

callPrinterAPI('/command', [
    'type' => 'printLine',
    'text' => 'Item 2: $15.50',
    'port' => 'LPT2'
], 'POST');

callPrinterAPI('/command', [
    'type' => 'printLine',
    'text' => 'Total: $25.50',
    'port' => 'LPT2'
], 'POST');

// Add some space
callPrinterAPI('/command', [
    'type' => 'newline',
    'count' => 2,
    'port' => 'LPT2'
], 'POST');

// Cut the paper
callPrinterAPI('/command', [
    'type' => 'cut',
    'port' => 'LPT2'
], 'POST');

echo "Receipt printed successfully!\n";

// Example 2: Check printer status
echo "Checking printer status...\n";
$status = callPrinterAPI('/printer-status', ['port' => 'LPT2'], 'POST');
echo "Status: " . json_encode($status) . "\n";

// Example 3: Get current settings
echo "Getting current settings...\n";
$settings = callPrinterAPI('/settings', ['port' => 'LPT2'], 'POST');
echo "Settings: " . json_encode($settings) . "\n";

?>

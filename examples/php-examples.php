<?php

/**
 * PHP Examples for Parallel Port Printer Server Integration
 *
 * Make sure your Node.js server is running on http://localhost:3000
 */

class ParallelPortPrinter {
    private $baseUrl;
    public $defaultPort = 'LPT1';

    public function __construct($baseUrl = 'http://localhost:3000') {
        $this->baseUrl = $baseUrl;
    }

    public function port($newPort) {
        if (!in_array($newPort, ['LPT1', 'LPT2'])) {
            throw new InvalidArgumentException("Invalid port specified. Use 'LPT1' or 'LPT2'.");
        }
        self::$defaultPort = $newPort;
    }

    /**
     * Make HTTP request to the Node.js server
     */
    private function makeRequest($endpoint, $method = 'POST', $data = null) {
        $url = $this->baseUrl . $endpoint;

        $options = [
            'http' => [
                'method' => $method,
                'header' => [
                    'Content-Type: application/json',
                    'Accept: application/json'
                ],
                'timeout' => 30
            ]
        ];

        if ($data !== null) {
            $options['http']['content'] = json_encode($data);
        }

        $context = stream_context_create($options);
        $response = file_get_contents($url, false, $context);

        if ($response === false) {
            throw new Exception("Failed to connect to printer server");
        }

        return json_decode($response, true);
    }

    /**
     * Get current printer settings
     */
    public function getSettings() {
        return $this->makeRequest('/settings');
    }

    /**
     * Set printer port (LPT1 or LPT2)
     */
    public function setPort($port) {
        if (!in_array($port, ['LPT1', 'LPT2'])) {
            throw new InvalidArgumentException("Port must be LPT1 or LPT2");
        }

        $ret = $this->makeRequest('/settings', 'POST', ['port' => $port]);
        $this->defaultPort = $port;
    }

    /**
     * Print a line of text
     */
    public function printLine($text, $port = null) {
        if (strlen($text) > 1000) {
            throw new InvalidArgumentException("Text too long (max 1000 characters)");
        }

        $data = [
            'type' => 'printLine',
            'text' => $text,
            'port' => $port ?? $this->defaultPort
        ];

        return $this->makeRequest('/command', 'POST', $data);
    }

    /**
     * Print new lines
     */
    public function newLine($count = 1, $port = null) {
        if ($count < 1 || $count > 50) {
            throw new InvalidArgumentException("Count must be between 1 and 50");
        }

        $data = [
            'type' => 'newline',
            'count' => $count,
            'port' => $port ?? $this->defaultPort
        ];

        return $this->makeRequest('/command', 'POST', $data);
    }

    /**
     * Cut paper
     */
    public function cut($port = null) {
        $data = [
            'type' => 'cut',
            'port' => $port ?? $this->defaultPort
        ];

        return $this->makeRequest('/command', 'POST', $data);
    }

    /**
     * Check printer status
     */
    public function checkStatus($port = null) {
        $data = [
            'port' => $port ?? $this->defaultPort
        ];

        return $this->makeRequest('/printer-status', 'POST', $data);
    }
}

// Usage Examples
try {
    $printer = new ParallelPortPrinter();

    // Example 1: Get current settings
    echo "=== Getting Current Settings ===\n";
    $settings = $printer->getSettings();
    print_r($settings);
    echo "\n";

    // Example 2: Set printer port
    echo "=== Setting Printer Port to LPT1 ===\n";
    $result = $printer->setPort('LPT1');
    print_r($result);
    echo "\n";

    // Example 3: Check printer status
    echo "=== Checking Printer Status ===\n";
    $status = $printer->checkStatus();
    print_r($status);
    echo "\n";

    // Example 4: Print some text
    echo "=== Printing Text ===\n";
    $result = $printer->printLine("Hello from PHP!");
    print_r($result);

    $result = $printer->printLine("This is a test print job");
    print_r($result);
    echo "\n";

    // Example 5: Add some new lines
    echo "=== Adding New Lines ===\n";
    $result = $printer->newLine(3);
    print_r($result);
    echo "\n";

    // Example 6: Cut paper
    echo "=== Cutting Paper ===\n";
    $result = $printer->cut();
    print_r($result);
    echo "\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

?>

<?php
/**
 * Simple Web Interface Example
 */
?>
<!DOCTYPE html>
<html>
<head>
    <title>PHP Printer Interface</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .form-group { margin: 10px 0; }
        label { display: inline-block; width: 120px; }
        input, select, textarea { padding: 5px; margin: 5px; }
        button { padding: 10px 20px; margin: 5px; background: #007cba; color: white; border: none; cursor: pointer; }
        button:hover { background: #005a87; }
        .result { background: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Parallel Port Printer - PHP Interface</h1>

    <?php
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        try {
            $printer = new ParallelPortPrinter();
            $result = null;

            switch ($_POST['action']) {
                case 'settings':
                    $result = $printer->getSettings();
                    break;

                case 'setPort':
                    $result = $printer->setPort($_POST['port']);
                    break;

                case 'print':
                    $result = $printer->printLine($_POST['text'], $_POST['port'] ?: null);
                    break;

                case 'newline':
                    $result = $printer->newLine((int)$_POST['count'], $_POST['port'] ?: null);
                    break;

                case 'cut':
                    $result = $printer->cut($_POST['port'] ?: null);
                    break;

                case 'status':
                    $result = $printer->checkStatus($_POST['port'] ?: null);
                    break;
            }

            if ($result) {
                echo '<div class="result"><strong>Result:</strong><pre>' . json_encode($result, JSON_PRETTY_PRINT) . '</pre></div>';
            }

        } catch (Exception $e) {
            echo '<div class="result" style="background: #ffebee;"><strong>Error:</strong> ' . htmlspecialchars($e->getMessage()) . '</div>';
        }
    }
    ?>

    <h2>Get Settings</h2>
    <form method="post">
        <input type="hidden" name="action" value="settings">
        <button type="submit">Get Current Settings</button>
    </form>

    <h2>Set Printer Port</h2>
    <form method="post">
        <input type="hidden" name="action" value="setPort">
        <div class="form-group">
            <label>Port:</label>
            <select name="port" required>
                <option value="LPT1">LPT1</option>
                <option value="LPT2">LPT2</option>
            </select>
        </div>
        <button type="submit">Set Port</button>
    </form>

    <h2>Print Text</h2>
    <form method="post">
        <input type="hidden" name="action" value="print">
        <div class="form-group">
            <label>Text:</label>
            <textarea name="text" rows="3" cols="50" required placeholder="Enter text to print..."></textarea>
        </div>
        <div class="form-group">
            <label>Port (optional):</label>
            <select name="port">
                <option value="">Default</option>
                <option value="LPT1">LPT1</option>
                <option value="LPT2">LPT2</option>
            </select>
        </div>
        <button type="submit">Print</button>
    </form>

    <h2>New Lines</h2>
    <form method="post">
        <input type="hidden" name="action" value="newline">
        <div class="form-group">
            <label>Count:</label>
            <input type="number" name="count" min="1" max="50" value="1" required>
        </div>
        <div class="form-group">
            <label>Port (optional):</label>
            <select name="port">
                <option value="">Default</option>
                <option value="LPT1">LPT1</option>
                <option value="LPT2">LPT2</option>
            </select>
        </div>
        <button type="submit">Add New Lines</button>
    </form>

    <h2>Cut Paper</h2>
    <form method="post">
        <input type="hidden" name="action" value="cut">
        <div class="form-group">
            <label>Port (optional):</label>
            <select name="port">
                <option value="">Default</option>
                <option value="LPT1">LPT1</option>
                <option value="LPT2">LPT2</option>
            </select>
        </div>
        <button type="submit">Cut Paper</button>
    </form>

    <h2>Check Printer Status</h2>
    <form method="post">
        <input type="hidden" name="action" value="status">
        <div class="form-group">
            <label>Port (optional):</label>
            <select name="port">
                <option value="">Default</option>
                <option value="LPT1">LPT1</option>
                <option value="LPT2">LPT2</option>
            </select>
        </div>
        <button type="submit">Check Status</button>
    </form>
</body>
</html>

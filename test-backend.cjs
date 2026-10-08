const { spawn } = require('child_process');
const http = require('http');

console.log('Starting Express server on port 3001...');

const serverProcess = spawn('node', ['server/index.js'], {
    env: { ...process.env, API_PORT: '3001' },
    stdio: 'pipe'
});

serverProcess.stdout.on('data', (data) => {
    console.log(`Server stdout: ${data}`);
    if (data.toString().includes('listening')) {
        runTests();
    }
});

serverProcess.stderr.on('data', (data) => {
    console.error(`Server stderr: ${data}`);
});

function runTests() {
    console.log('Sending mock request to /api/ai/extract-bill...');
    const req1 = http.request('http://localhost:3001/api/ai/extract-bill', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log(`/api/ai/extract-bill Response Status: ${res.statusCode}`);
            console.log(`/api/ai/extract-bill Response Body: ${data}`);
            
            console.log('Sending mock request to /api/push/subscribe...');
            const req2 = http.request('http://localhost:3001/api/push/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            }, (res2) => {
                let data2 = '';
                res2.on('data', chunk => data2 += chunk);
                res2.on('end', () => {
                    console.log(`/api/push/subscribe Response Status: ${res2.statusCode}`);
                    console.log(`/api/push/subscribe Response Body: ${data2}`);
                    
                    console.log('Killing server...');
                    serverProcess.kill();
                    process.exit(0);
                });
            });
            req2.write(JSON.stringify({ subscription: { endpoint: 'https://example.com' } }));
            req2.end();
        });
    });
    req1.write(JSON.stringify({}));
    req1.end();
}

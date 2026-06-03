const http = require('http');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

// Load config
let port = 6000;
try {
    const configPath = path.join(__dirname, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.Port) port = config.Port;
} catch (e) {}

// MIME types for static files
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ui': 'text/plain',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.eot': 'application/vnd.ms-fontobject',
    '.ico': 'image/x-icon',
};

// Parse multipart/form-data manually (no external deps)
function parseMultipart(req, res) {
    return new Promise((resolve, reject) => {
        const contentType = req.headers['content-type'] || '';
        
        // Extract boundary - handle both quoted and unquoted formats
        let boundary = null;
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
        if (boundaryMatch) {
            boundary = boundaryMatch[1] || boundaryMatch[2];
        } else {
            // Try simpler pattern
            const simpleMatch = contentType.match(/boundary=([^\s,;]+)/i);
            if (simpleMatch) {
                boundary = simpleMatch[1].replace(/["']/g, '');
            }
        }
        
        if (!boundary) {
            reject(new Error('No boundary found in content-type'));
            return;
        }
        
        let body = Buffer.from('');
        req.on('data', chunk => { 
            body = Buffer.concat([body, chunk]); 
        });
        req.on('end', () => {
            try {
                const result = parseFormData(body, boundary);
                resolve(result);
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', err => reject(err));
    });
}

function parseFormData(body, boundary) {
    const results = [];
    
    // Build the boundary marker as a buffer for comparison
    const boundaryPrefix = Buffer.from(`--${boundary}\r\n`);
    
    let offset = 0;
    let partIndex = 0;
    
    while (offset < body.length) {
        // Check if we're at a boundary
        const isBoundary = body.slice(offset, offset + boundaryPrefix.length).equals(boundaryPrefix);
        
        if (!isBoundary) break;
        
        // Skip the boundary prefix
        offset += boundaryPrefix.length;
        
        // Check for final boundary (--)
        if (body.slice(offset - 4, offset + 2).equals(Buffer.from('--'))) {
            break;
        }
        
        // Find header end (\r\n\r\n)
        const headerEndIdx = body.indexOf('\r\n\r\n', offset);
        if (headerEndIdx === -1) break;
        
        const headersStr = body.slice(offset, headerEndIdx).toString('utf-8');
        
        // Parse Content-Disposition
        const cdMatch = headersStr.match(/content-disposition:\s*form-data;\s*name="([^"]+)";?\s*filename="([^"]*)"/i);
        if (!cdMatch) {
            partIndex++;
            const nextBoundary = body.indexOf(Buffer.from('\r\n--'), headerEndIdx);
            if (nextBoundary === -1) break;
            offset = nextBoundary;
            continue;
        }
        
        const fieldName = cdMatch[1];
        const filename = cdMatch[2] || '';
        
        // Content starts after \r\n\r\n
        let contentStart = headerEndIdx + 4;
        
        // Find end of content (next boundary)
        let contentEnd = body.indexOf('\r\n--', contentStart);
        if (contentEnd === -1) {
            contentEnd = body.length;
        } else {
            // Only remove trailing \r\n if it actually exists (not part of binary data)
            const crlfLen = 2;
            if (contentEnd >= contentStart + crlfLen && 
                body[contentEnd - 2] === 0x0D && body[contentEnd - 1] === 0x0A) {
                contentEnd -= crlfLen; // Remove trailing \r\n from multipart format
            }
        }
        
        const content = body.slice(contentStart, contentEnd);
        results.push({ fieldName, filename, content });
        partIndex++;
        
        offset = contentEnd;
    }
    
    return results;
}

const server = http.createServer(async (req, res) => {
    // Handle CORS for API requests
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204, { 
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    // API: Upload files (multipart/form-data)
    if (req.url.startsWith('/api/upload') && req.method === 'POST') {
        try {
            const formData = await parseMultipart(req, res);
            
            let uploadedCount = 0;
            let errors = [];
            
            for (const field of formData) {
                if (!field.filename || !field.content) continue;
                
                // Extract relative path from filename (webkitRelativePath format: "folder/sub/file.png")
                const fullPath = path.join(__dirname, 'www', field.filename);
                const dir = path.dirname(fullPath);
                
                // Create directory if not exists
                try { fs.mkdirSync(dir, { recursive: true }); } catch(e) {}
                
                // Write file
                fs.writeFileSync(fullPath, field.content);
                uploadedCount++;
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                count: uploadedCount,
                message: `已上傳 ${uploadedCount} 個檔案`
            }));
        } catch (err) {
            console.error('Upload error:', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
    }

    // API: List directory contents
    if (req.url.startsWith('/api/dir?path=')) {
        const dirPath = decodeURIComponent(req.url.split('path=')[1]);
        const fullPath = path.join(__dirname, 'www', dirPath);

        try {
            const entries = fs.readdirSync(fullPath, { withFileTypes: true });
            const files = entries.map(entry => ({
                name: entry.name,
                isDirectory: entry.isDirectory(),
                ext: path.extname(entry.name).toLowerCase()
            }));
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ files }));
        } catch (err) {
            console.error(`Failed to list directory ${dirPath}:`, err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // API: Get file content (for .ui files)
    if (req.url.startsWith('/api/file?path=')) {
        const filePath = decodeURIComponent(req.url.split('path=')[1]);
        const fullPath = path.join(__dirname, 'www', filePath);

        try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(content);
        } catch (err) {
            console.error(`Failed to read file ${filePath}:`, err.message);
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Serve static files from www/ directory
    let filePath = req.url.split('?')[0]; // Remove query string
    if (filePath === '/') filePath = '/index.html';

    const fullFilePath = path.join(__dirname, 'www', filePath);
    const ext = path.extname(fullFilePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(fullFilePath, (err, data) => {
        if (err) {
            console.error(`Failed to serve ${filePath}:`, err.message);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
        }

        res.writeHead(200, { 
            'Content-Type': contentType,
            'Cache-Control': 'no-cache' // Always reload for development
        });
        res.end(data);
    });
});

server.listen(port, () => {
    console.log(`zlui-ts View server running at http://localhost:${port}`);
    console.log(`Serving files from ${path.join(__dirname, 'www')}`);
});

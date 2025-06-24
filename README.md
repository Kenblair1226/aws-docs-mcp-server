# AWS Documentation MCP Server - Cloudflare Workers

This is a port of the AWS Documentation MCP Server to run on Cloudflare Workers with HTTP streaming support.

## Features

- **HTTP-based MCP Protocol**: REST API endpoints instead of stdio transport
- **Server-Sent Events (SSE)**: Streaming responses for real-time updates
- **Cloudflare Workers**: Edge computing for low latency globally
- **TypeScript**: Type-safe implementation with modern JavaScript features

## Available Tools

1. **read_documentation** - Fetch and convert AWS documentation pages to markdown
2. **search_documentation** - Search AWS documentation using the official search API
3. **recommend** - Get content recommendations for AWS documentation pages

## API Endpoints

### MCP Protocol Endpoints

- `GET /mcp/info` - Server information and capabilities
- `GET /mcp/tools/list` - List available tools
- `POST /mcp/tools/call` - Execute tools (JSON request/response)
- `GET /mcp/stream` - SSE connection for streaming
- `POST /mcp/tools/stream` - Execute tools with streaming response

### Utility Endpoints

- `GET /health` - Health check
- `GET /` - API documentation

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Development:**
   ```bash
   npm run dev
   ```

3. **Deploy to Cloudflare Workers:**
   ```bash
   npm run deploy
   ```

## Usage Examples

### Using curl

**List available tools:**
```bash
curl https://your-worker.your-subdomain.workers.dev/mcp/tools/list
```

**Read documentation:**
```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{"params": {"name": "read_documentation", "arguments": {"url": "https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucketnamingrules.html"}}}'
```

**Search documentation:**
```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{"params": {"name": "search_documentation", "arguments": {"search_phrase": "S3 bucket naming", "limit": 5}}}'
```

**Get recommendations:**
```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{"params": {"name": "recommend", "arguments": {"url": "https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucketnamingrules.html"}}}'
```

### Using Server-Sent Events

**Connect to streaming endpoint:**
```bash
curl -N https://your-worker.your-subdomain.workers.dev/mcp/stream
```

**Execute tool with streaming:**
```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/mcp/tools/stream \
  -H "Content-Type: application/json" \
  -d '{"params": {"name": "read_documentation", "arguments": {"url": "https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucketnamingrules.html"}}}' \
  -N
```

### JavaScript/TypeScript Client

```typescript
// Regular HTTP call
const response = await fetch('https://your-worker.your-subdomain.workers.dev/mcp/tools/call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    params: {
      name: 'search_documentation',
      arguments: {
        search_phrase: 'Lambda functions',
        limit: 10
      }
    }
  })
});

const result = await response.json();

// Server-Sent Events
const eventSource = new EventSource('https://your-worker.your-subdomain.workers.dev/mcp/stream');

eventSource.addEventListener('connection', (event) => {
  console.log('Connected:', JSON.parse(event.data));
});

eventSource.addEventListener('result', (event) => {
  console.log('Result:', JSON.parse(event.data));
});

eventSource.addEventListener('error', (event) => {
  console.error('Error:', JSON.parse(event.data));
});
```

## Configuration

Update `wrangler.toml` to configure:

```toml
[vars]
AWS_DOCUMENTATION_PARTITION = "aws"  # or "aws-cn" for China regions
FASTMCP_LOG_LEVEL = "ERROR"
```

## Differences from Python Version

1. **Transport**: HTTP instead of stdio
2. **Runtime**: JavaScript/TypeScript instead of Python
3. **Streaming**: Server-Sent Events instead of JSON-RPC
4. **Dependencies**: Native Web APIs instead of Python libraries
5. **Deployment**: Cloudflare Workers instead of local process

## Performance Benefits

- **Edge Computing**: Runs globally on Cloudflare's edge network
- **Low Latency**: Reduced response times due to geographic distribution
- **Scalability**: Auto-scaling with Cloudflare Workers platform
- **Caching**: Built-in HTTP caching for documentation pages

## Error Handling

The server returns standard HTTP status codes and JSON error responses:

```json
{
  "error": {
    "code": -32601,
    "message": "Unknown tool: invalid_tool_name"
  }
}
```

Common error codes:
- `-32601`: Method not found (unknown tool)
- `-32602`: Invalid params 
- `-32603`: Internal error
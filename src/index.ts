import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { cors } from 'hono/cors';
import { MCPRequest, MCPResponse } from './types';
import { TOOL_DEFINITIONS, readDocumentation, searchDocumentation, recommend } from './tools';
import { generateSessionId } from './utils';

const app = new Hono();

// Add CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Session storage for maintaining state across requests
const sessions = new Map<string, string>();

// MCP protocol endpoints
app.get('/mcp/info', (c) => {
  return c.json({
    name: 'awslabs.aws-documentation-mcp-server',
    version: '1.1.0',
    description: 'AWS Documentation MCP Server for Cloudflare Workers',
    protocol_version: '2024-11-05',
    capabilities: {
      tools: {},
      logging: {},
      resources: {}
    }
  });
});

app.get('/mcp/tools/list', (c) => {
  return c.json({
    tools: TOOL_DEFINITIONS
  });
});

// HTTP-based MCP tool execution
app.post('/mcp/tools/call', async (c) => {
  try {
    const request: MCPRequest = await c.req.json();
    
    if (!request.params?.name) {
      return c.json({
        error: {
          code: -32602,
          message: 'Invalid params: tool name is required'
        }
      }, 400);
    }

    const toolName = request.params.name;
    const args = request.params.arguments || {};
    
    // Get or create session
    const sessionHeader = c.req.header('X-MCP-Session-Id');
    let sessionId = sessionHeader || generateSessionId();
    
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, sessionId);
    }

    let result: any;

    switch (toolName) {
      case 'read_documentation':
        result = await readDocumentation(
          args.url,
          args.max_length || 5000,
          args.start_index || 0,
          sessionId
        );
        break;
        
      case 'search_documentation':
        result = await searchDocumentation(
          args.search_phrase,
          args.limit || 10,
          sessionId
        );
        break;
        
      case 'recommend':
        result = await recommend(args.url, sessionId);
        break;
        
      default:
        return c.json({
          error: {
            code: -32601,
            message: `Unknown tool: ${toolName}`
          }
        }, 404);
    }

    const response: MCPResponse = { result };
    return c.json(response);

  } catch (error) {
    console.error('Tool execution error:', error);
    return c.json({
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error'
      }
    }, 500);
  }
});

// Server-Sent Events endpoint for streaming responses
app.get('/mcp/stream', (c) => {
  return streamSSE(c, async (stream) => {
    // Send initial connection message
    await stream.writeSSE({
      data: JSON.stringify({
        type: 'connection_established',
        session_id: generateSessionId()
      }),
      event: 'connection'
    });

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(async () => {
      try {
        await stream.writeSSE({
          data: JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }),
          event: 'heartbeat'
        });
      } catch (error) {
        clearInterval(heartbeat);
      }
    }, 30000);

    // Handle client disconnect
    stream.onAbort(() => {
      clearInterval(heartbeat);
    });
  });
});

// Streaming tool execution endpoint
app.post('/mcp/tools/stream', async (c) => {
  const request: MCPRequest = await c.req.json();
  
  return streamSSE(c, async (stream) => {
    try {
      if (!request.params?.name) {
        await stream.writeSSE({
          data: JSON.stringify({
            error: {
              code: -32602,
              message: 'Invalid params: tool name is required'
            }
          }),
          event: 'error'
        });
        return;
      }

      const toolName = request.params.name;
      const args = request.params.arguments || {};
      
      // Get or create session
      const sessionHeader = c.req.header('X-MCP-Session-Id');
      let sessionId = sessionHeader || generateSessionId();
      
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, sessionId);
      }

      // Send progress updates for long-running operations
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'progress',
          message: `Executing ${toolName}...`
        }),
        event: 'progress'
      });

      let result: any;

      switch (toolName) {
        case 'read_documentation':
          result = await readDocumentation(
            args.url,
            args.max_length || 5000,
            args.start_index || 0,
            sessionId
          );
          break;
          
        case 'search_documentation':
          result = await searchDocumentation(
            args.search_phrase,
            args.limit || 10,
            sessionId
          );
          break;
          
        case 'recommend':
          result = await recommend(args.url, sessionId);
          break;
          
        default:
          await stream.writeSSE({
            data: JSON.stringify({
              error: {
                code: -32601,
                message: `Unknown tool: ${toolName}`
              }
            }),
            event: 'error'
          });
          return;
      }

      // Send the final result
      await stream.writeSSE({
        data: JSON.stringify({ result }),
        event: 'result'
      });

    } catch (error) {
      console.error('Streaming tool execution error:', error);
      await stream.writeSSE({
        data: JSON.stringify({
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Internal error'
          }
        }),
        event: 'error'
      });
    }
  });
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Root endpoint with API documentation
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>AWS Documentation MCP Server</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #333; }
            .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 4px; }
            .method { font-weight: bold; color: #0066cc; }
        </style>
    </head>
    <body>
        <h1>AWS Documentation MCP Server</h1>
        <p>Model Context Protocol (MCP) server for AWS Documentation running on Cloudflare Workers</p>
        
        <h2>Available Endpoints:</h2>
        
        <div class="endpoint">
            <div class="method">GET /mcp/info</div>
            <div>Get server information and capabilities</div>
        </div>
        
        <div class="endpoint">
            <div class="method">GET /mcp/tools/list</div>
            <div>List available tools</div>
        </div>
        
        <div class="endpoint">
            <div class="method">POST /mcp/tools/call</div>
            <div>Execute a tool (JSON request/response)</div>
        </div>
        
        <div class="endpoint">
            <div class="method">GET /mcp/stream</div>
            <div>Server-Sent Events connection for streaming</div>
        </div>
        
        <div class="endpoint">
            <div class="method">POST /mcp/tools/stream</div>
            <div>Execute a tool with streaming response</div>
        </div>
        
        <div class="endpoint">
            <div class="method">GET /health</div>
            <div>Health check endpoint</div>
        </div>

        <h2>Available Tools:</h2>
        <ul>
            <li><strong>read_documentation</strong> - Fetch and convert AWS documentation to markdown</li>
            <li><strong>search_documentation</strong> - Search AWS documentation</li>
            <li><strong>recommend</strong> - Get content recommendations for AWS documentation pages</li>
        </ul>
    </body>
    </html>
  `);
});

export default app;
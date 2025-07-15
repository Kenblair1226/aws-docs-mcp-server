import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Add CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// MCP Server Info
const SERVER_INFO = {
  name: 'AWS Documentation MCP Server',
  version: '1.1.0',
  description: 'AWS Documentation MCP Server for Cloudflare Workers',
  protocol_version: '2024-11-05',
  capabilities: {
    tools: {
      listChanged: true
    },
    logging: {},
    resources: {}
  }
};

// Tool definitions
const TOOLS = [
  {
    name: 'read_documentation',
    description: 'Fetch and convert AWS documentation to markdown',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'URL of the AWS documentation page to read'
        },
        max_length: {
          type: 'number',
          minimum: 1,
          maximum: 50000,
          default: 5000,
          description: 'Maximum number of characters to return'
        },
        start_index: {
          type: 'number',
          minimum: 0,
          default: 0,
          description: 'Start content from this character index'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'search_documentation',
    description: 'Search AWS documentation',
    inputSchema: {
      type: 'object',
      properties: {
        search_phrase: {
          type: 'string',
          description: 'Search phrase to look for in AWS documentation'
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Maximum number of search results to return'
        }
      },
      required: ['search_phrase']
    }
  },
  {
    name: 'recommend',
    description: 'Get content recommendations for AWS documentation pages',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'URL of the AWS documentation page to get recommendations for'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'hello',
    description: 'Test connectivity',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Extract and convert HTML content to Markdown format
function extractContentFromHtml(html: string): string {
  try {
    let markdown = html;

    // Remove script and style tags
    markdown = markdown.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    markdown = markdown.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    markdown = markdown.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
    
    // Convert headers
    markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
    markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
    markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
    markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
    markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');

    // Convert paragraphs
    markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');

    // Convert line breaks
    markdown = markdown.replace(/<br\s*\/?>/gi, '\n');

    // Convert links
    markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

    // Convert bold and italic
    markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

    // Convert unordered lists
    markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
      return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n') + '\n';
    });
    
    // Convert ordered lists
    markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
      let counter = 1;
      return content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${counter++}. $1\n`) + '\n';
    });

    // Convert code blocks
    markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
    markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

    // Convert blockquotes
    markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match, content) => {
      return content.split('\n').map((line: string) => `> ${line.trim()}`).join('\n') + '\n\n';
    });

    // Convert horizontal rules
    markdown = markdown.replace(/<hr[^>]*>/gi, '---\n\n');

    // Convert images
    markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)');
    markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)');

    // Remove remaining HTML tags
    markdown = markdown.replace(/<[^>]*>/g, '');

    // Decode HTML entities
    markdown = markdown.replace(/&amp;/g, '&');
    markdown = markdown.replace(/&lt;/g, '<');
    markdown = markdown.replace(/&gt;/g, '>');
    markdown = markdown.replace(/&quot;/g, '"');
    markdown = markdown.replace(/&#39;/g, "'");
    markdown = markdown.replace(/&nbsp;/g, ' ');

    // Clean up extra whitespace
    markdown = markdown.replace(/\n\s*\n\s*\n/g, '\n\n');
    markdown = markdown.replace(/^\s+|\s+$/g, '');

    return markdown || 'Page failed to be simplified from HTML';
  } catch (error) {
    return 'Page failed to be simplified from HTML';
  }
}

// Tool implementations
async function executeTool(name: string, args: any) {
  switch (name) {
    case 'read_documentation':
      return await readDocumentation(args.url, args.max_length || 5000, args.start_index || 0);
    case 'search_documentation':
      return await searchDocumentation(args.search_phrase, args.limit || 10);
    case 'recommend':
      return await recommend(args.url);
    case 'hello':
      return {
        content: [{
          type: "text",
          text: "Hello from the AWS Documentation MCP Server running on Cloudflare Workers!"
        }]
      };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function readDocumentation(url: string, max_length: number, start_index: number) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AWS-Documentation-MCP-Server/1.1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return {
        content: [{
          type: "text",
          text: `Failed to fetch ${url} - status code ${response.status}`
        }]
      };
    }

    const content = await response.text();
    const processedContent = extractContentFromHtml(content);
    
    // Handle content slicing
    const originalLength = processedContent.length;
    
    if (start_index >= originalLength) {
      return {
        content: [{
          type: "text",
          text: 'No more content available.'
        }]
      };
    }

    const slicedContent = processedContent.slice(start_index, start_index + max_length);
    
    if (!slicedContent) {
      return {
        content: [{
          type: "text",
          text: 'No more content available.'
        }]
      };
    }

    // Add continuation message if content was truncated
    let result = slicedContent;
    const actualContentLength = slicedContent.length;
    const remainingContent = originalLength - (start_index + actualContentLength);
    
    if (actualContentLength === max_length && remainingContent > 0) {
      const nextStart = start_index + actualContentLength;
      result += `\n\nContent truncated. Call read_documentation with start_index=${nextStart} to get more content.`;
    }

    return {
      content: [{
        type: "text",
        text: `Contents of ${url}:\n\n${result}`
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}

async function searchDocumentation(search_phrase: string, limit: number) {
  try {
    const searchUrl = `https://docs.aws.amazon.com/search.html?searchPath=documentation&searchQuery=${encodeURIComponent(search_phrase)}`;
    
    return {
      content: [{
        type: "text",
        text: `Search results for "${search_phrase}":\n\nTo search AWS documentation, visit: ${searchUrl}\n\nNote: This tool provides search guidance. For full search functionality, use the AWS documentation website directly.`
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Search failed: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}

async function recommend(url: string) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const service = pathParts.find(part => part.length > 0) || 'aws';

    return {
      content: [{
        type: "text",
        text: `Related AWS documentation recommendations for ${url}:\n\n- AWS ${service} User Guide\n- AWS ${service} API Reference\n- AWS ${service} Best Practices\n- AWS ${service} Troubleshooting Guide\n\nFor specific recommendations, visit the AWS documentation website and explore the related links section.`
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Failed to generate recommendations: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}

// Handle MCP JSON-RPC requests
async function handleMCPRequest(request: any) {
  const { method, params, id } = request;

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: SERVER_INFO.capabilities,
            serverInfo: {
              name: SERVER_INFO.name,
              version: SERVER_INFO.version
            }
          }
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: TOOLS
          }
        };

      case 'tools/call':
        if (!params?.name) {
          throw new Error('Tool name is required');
        }
        const result = await executeTool(params.name, params.arguments || {});
        return {
          jsonrpc: '2.0',
          id,
          result
        };

      case 'ping':
        return {
          jsonrpc: '2.0',
          id,
          result: {}
        };

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

// MCP endpoint - supports both GET and POST
app.all('/mcp', async (c) => {
  if (c.req.method === 'GET') {
    // Return server info for dynamic client registration
    return c.json(SERVER_INFO);
  }

  if (c.req.method === 'POST') {
    try {
      const request = await c.req.json();
      const response = await handleMCPRequest(request);
      return c.json(response);
    } catch (error) {
      return c.json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error'
        }
      }, 400);
    }
  }

  return c.json({ error: 'Method not allowed' }, 405);
});

// Root endpoint with documentation
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
            <div class="method">GET/POST /mcp</div>
            <div>Standard MCP endpoint</div>
        </div>

        <h2>Available Tools:</h2>
        <ul>
            <li><strong>read_documentation</strong> - Fetch and convert AWS documentation to markdown</li>
            <li><strong>search_documentation</strong> - Search AWS documentation</li>
            <li><strong>recommend</strong> - Get content recommendations for AWS documentation pages</li>
            <li><strong>hello</strong> - Test connectivity</li>
        </ul>
    </body>
    </html>
  `);
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

export default {
  fetch: app.fetch,
};
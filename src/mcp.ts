import { TOOL_DEFINITIONS, readDocumentation, searchDocumentation, recommend } from './tools';

interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class MCPServer {
  private tools = new Map<string, Function>();
  
  constructor() {
    this.tools.set('read_documentation', readDocumentation);
    this.tools.set('search_documentation', searchDocumentation);
    this.tools.set('recommend', recommend);
  }

  async handleMessage(message: MCPMessage): Promise<MCPMessage> {
    if (!message.id) {
      throw new Error('Message must have an id');
    }

    try {
      switch (message.method) {
        case 'initialize':
          return {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {
                  listChanged: true
                },
                logging: {},
                resources: {}
              },
              serverInfo: {
                name: 'awslabs.aws-documentation-mcp-server',
                version: '1.1.0'
              }
            }
          };

        case 'tools/list':
          return {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              tools: TOOL_DEFINITIONS
            }
          };

        case 'tools/call':
          const toolName = message.params?.name;
          const args = message.params?.arguments || {};
          
          if (!toolName || !this.tools.has(toolName)) {
            return {
              jsonrpc: '2.0',
              id: message.id,
              error: {
                code: -32601,
                message: `Unknown tool: ${toolName}`
              }
            };
          }

          const tool = this.tools.get(toolName)!;
          const sessionId = 'mcp-session-' + Date.now();
          
          let result: any;
          switch (toolName) {
            case 'read_documentation':
              result = await tool(
                args.url,
                args.max_length || 5000,
                args.start_index || 0,
                sessionId
              );
              break;
            case 'search_documentation':
              result = await tool(
                args.search_phrase,
                args.limit || 10,
                sessionId
              );
              break;
            case 'recommend':
              result = await tool(args.url, sessionId);
              break;
            default:
              throw new Error(`Unhandled tool: ${toolName}`);
          }

          return {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                }
              ]
            }
          };

        default:
          return {
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32601,
              message: `Unknown method: ${message.method}`
            }
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error'
        }
      };
    }
  }
}
export interface SearchResult {
  rank_order: number;
  url: string;
  title: string;
  context?: string;
}

export interface RecommendationResult {
  url: string;
  title: string;
  context?: string;
}

export interface MCPRequest {
  method: string;
  params?: {
    name?: string;
    arguments?: Record<string, any>;
  };
}

export interface MCPResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

export interface MCPToolInfo {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}
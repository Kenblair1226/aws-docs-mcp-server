import { SearchResult, RecommendationResult, MCPToolInfo } from './types';
import { 
  extractContentFromHtml, 
  formatDocumentationResult, 
  getUserAgent, 
  isHtmlContent,
  parseRecommendationResults 
} from './utils';

const SEARCH_API_URL = 'https://proxy.search.docs.aws.amazon.com/search';
const RECOMMENDATIONS_API_URL = 'https://contentrecs-api.docs.aws.amazon.com/v1/recommendations';

export const TOOL_DEFINITIONS: MCPToolInfo[] = [
  {
    name: 'read_documentation',
    description: 'Fetch and convert an AWS documentation page to markdown format',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the AWS documentation page to read'
        },
        max_length: {
          type: 'number',
          description: 'Maximum number of characters to return',
          default: 5000,
          minimum: 1,
          maximum: 1000000
        },
        start_index: {
          type: 'number', 
          description: 'Starting character index for pagination',
          default: 0,
          minimum: 0
        }
      },
      required: ['url']
    }
  },
  {
    name: 'search_documentation',
    description: 'Search AWS documentation using the official AWS Documentation Search API',
    inputSchema: {
      type: 'object',
      properties: {
        search_phrase: {
          type: 'string',
          description: 'Search phrase to use'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return',
          default: 10,
          minimum: 1,
          maximum: 50
        }
      },
      required: ['search_phrase']
    }
  },
  {
    name: 'recommend',
    description: 'Get content recommendations for an AWS documentation page',
    inputSchema: {
      type: 'object', 
      properties: {
        url: {
          type: 'string',
          description: 'URL of the AWS documentation page to get recommendations for'
        }
      },
      required: ['url']
    }
  }
];

export async function readDocumentation(
  url: string,
  maxLength: number = 5000,
  startIndex: number = 0,
  sessionId: string
): Promise<string> {
  // Validate URL
  if (!url.match(/^https?:\/\/docs\.aws\.amazon\.com\//)) {
    throw new Error('URL must be from the docs.aws.amazon.com domain');
  }
  if (!url.endsWith('.html')) {
    throw new Error('URL must end with .html');
  }

  const urlWithSession = `${url}?session=${sessionId}`;

  try {
    const response = await fetch(urlWithSession, {
      headers: {
        'User-Agent': getUserAgent(),
        'X-MCP-Session-Id': sessionId
      },
      cf: {
        cacheTtl: 300 // Cache for 5 minutes
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url} - status code ${response.status}`);
    }

    const pageRaw = await response.text();
    const contentType = response.headers.get('content-type') || '';

    let content: string;
    if (isHtmlContent(pageRaw, contentType)) {
      content = extractContentFromHtml(pageRaw);
    } else {
      content = pageRaw;
    }

    return formatDocumentationResult(url, content, startIndex, maxLength);
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error}`);
  }
}

export async function searchDocumentation(
  searchPhrase: string,
  limit: number = 10,
  sessionId: string
): Promise<SearchResult[]> {
  const requestBody = {
    textQuery: {
      input: searchPhrase
    },
    contextAttributes: [{ key: 'domain', value: 'docs.aws.amazon.com' }],
    acceptSuggestionBody: 'RawText',
    locales: ['en_us']
  };

  const searchUrlWithSession = `${SEARCH_API_URL}?session=${sessionId}`;

  try {
    const response = await fetch(searchUrlWithSession, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
        'X-MCP-Session-Id': sessionId
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Error searching AWS docs - status code ${response.status}`);
    }

    const data = await response.json();
    const results: SearchResult[] = [];

    if (data.suggestions) {
      for (let i = 0; i < Math.min(data.suggestions.length, limit); i++) {
        const suggestion = data.suggestions[i];
        if (suggestion.textExcerptSuggestion) {
          const textSuggestion = suggestion.textExcerptSuggestion;
          let context = null;

          if (textSuggestion.summary) {
            context = textSuggestion.summary;
          } else if (textSuggestion.suggestionBody) {
            context = textSuggestion.suggestionBody;
          }

          results.push({
            rank_order: i + 1,
            url: textSuggestion.link || '',
            title: textSuggestion.title || '',
            context
          });
        }
      }
    }

    return results;
  } catch (error) {
    throw new Error(`Error searching AWS docs: ${error}`);
  }
}

export async function recommend(url: string, sessionId: string): Promise<RecommendationResult[]> {
  const recommendationUrl = `${RECOMMENDATIONS_API_URL}?path=${url}&session=${sessionId}`;

  try {
    const response = await fetch(recommendationUrl, {
      headers: {
        'User-Agent': getUserAgent()
      }
    });

    if (!response.ok) {
      throw new Error(`Error getting recommendations - status code ${response.status}`);
    }

    const data = await response.json();
    return parseRecommendationResults(data);
  } catch (error) {
    throw new Error(`Error getting recommendations: ${error}`);
  }
}
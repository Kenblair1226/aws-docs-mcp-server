import { parse } from 'node-html-parser';
import TurndownService from 'turndown';
import { RecommendationResult } from './types';

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 ModelContextProtocol/1.1.0 (AWS Documentation Server)';

export function generateSessionId(): string {
  return crypto.randomUUID();
}

export function getUserAgent(): string {
  return DEFAULT_USER_AGENT;
}

export function extractContentFromHtml(html: string): string {
  if (!html) {
    return '<e>Empty HTML content</e>';
  }

  try {
    const root = parse(html);
    
    // Common content container selectors for AWS documentation
    const contentSelectors = [
      'main',
      'article', 
      '#main-content',
      '.main-content',
      '#content',
      '.content',
      "div[role='main']",
      '#awsdocs-content',
      '.awsui-article'
    ];

    let mainContent = null;
    
    // Try to find the main content using common selectors
    for (const selector of contentSelectors) {
      const content = root.querySelector(selector);
      if (content) {
        mainContent = content;
        break;
      }
    }

    // If no main content found, use the body
    if (!mainContent) {
      mainContent = root.querySelector('body') || root;
    }

    // Remove navigation elements
    const navSelectors = [
      'noscript',
      '.prev-next',
      '#main-col-footer', 
      '.awsdocs-page-utilities',
      '#quick-feedback-yes',
      '#quick-feedback-no',
      '.page-loading-indicator',
      '#tools-panel',
      '.doc-cookie-banner',
      'awsdocs-copyright',
      'awsdocs-thumb-feedback',
      'script',
      'style',
      'meta',
      'link',
      'footer',
      'nav',
      'aside',
      'header'
    ];

    for (const selector of navSelectors) {
      const elements = mainContent.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    }

    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });

    const markdown = turndownService.turndown(mainContent.innerHTML);
    
    if (!markdown) {
      return '<e>Page failed to be simplified from HTML</e>';
    }

    return markdown;
  } catch (error) {
    return `<e>Error converting HTML to Markdown: ${error}</e>`;
  }
}

export function isHtmlContent(pageRaw: string, contentType: string): boolean {
  return pageRaw.substring(0, 100).includes('<html') || 
         contentType.includes('text/html') || 
         !contentType;
}

export function formatDocumentationResult(
  url: string, 
  content: string, 
  startIndex: number, 
  maxLength: number
): string {
  const originalLength = content.length;

  if (startIndex >= originalLength) {
    return `AWS Documentation from ${url}:\n\n<e>No more content available.</e>`;
  }

  const endIndex = Math.min(startIndex + maxLength, originalLength);
  const truncatedContent = content.substring(startIndex, endIndex);

  if (!truncatedContent) {
    return `AWS Documentation from ${url}:\n\n<e>No more content available.</e>`;
  }

  const actualContentLength = truncatedContent.length;
  const remainingContent = originalLength - (startIndex + actualContentLength);

  let result = `AWS Documentation from ${url}:\n\n${truncatedContent}`;

  if (remainingContent > 0) {
    const nextStart = startIndex + actualContentLength;
    result += `\n\n<e>Content truncated. Call the read_documentation tool with start_index=${nextStart} to get more content.</e>`;
  }

  return result;
}

export function parseRecommendationResults(data: any): RecommendationResult[] {
  const results: RecommendationResult[] = [];

  // Process highly rated recommendations
  if (data.highlyRated?.items) {
    for (const item of data.highlyRated.items) {
      const context = item.abstract || null;
      results.push({
        url: item.url || '',
        title: item.assetTitle || '',
        context
      });
    }
  }

  // Process journey recommendations
  if (data.journey?.items) {
    for (const intentGroup of data.journey.items) {
      const intent = intentGroup.intent || '';
      if (intentGroup.urls) {
        for (const urlItem of intentGroup.urls) {
          const context = intent ? `Intent: ${intent}` : null;
          results.push({
            url: urlItem.url || '',
            title: urlItem.assetTitle || '', 
            context
          });
        }
      }
    }
  }

  // Process new content recommendations
  if (data.new?.items) {
    for (const item of data.new.items) {
      const dateCreated = item.dateCreated || '';
      const context = dateCreated ? `New content added on ${dateCreated}` : 'New content';
      results.push({
        url: item.url || '',
        title: item.assetTitle || '',
        context
      });
    }
  }

  // Process similar recommendations
  if (data.similar?.items) {
    for (const item of data.similar.items) {
      const context = item.abstract || 'Similar content';
      results.push({
        url: item.url || '',
        title: item.assetTitle || '',
        context
      });
    }
  }

  return results;
}
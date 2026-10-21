'use server';

import { SearchResult, SearchResponse } from '@/types';
import type { CustomerAccountData } from '@/types';

// Function to create static pages based on customer account data
function createStaticPages(customerAccount: CustomerAccountData | null, customerDashboardData: any | null): SearchResult[] {
  const pages: SearchResult[] = [
    // Customer pages
    { 
      id: 'account', 
      title: 'Account Overview', 
      description: 'View your account details and settings',
      url: '/account', 
      type: 'page',
      metadata: { section: 'customer' },
      criteria: customerAccount?.enabledFeatures?.modulesEnabled
    },
    { 
      id: 'account-modules', 
      title: 'Modules', 
      description: 'View and manage your software modules',
      url: '/account/modules', 
      type: 'page',
      metadata: { section: 'customer' },
      criteria: customerAccount?.enabledFeatures?.modulesEnabled
    },
    { 
      id: 'account-settings', 
      title: 'Settings & Team Management', 
      description: `Manage your account${customerAccount?.enabledFeatures?.teamEnabled ? ', team members and permissions' : ''}`,
      url: '/account/settings', 
      type: 'page',
      metadata: { section: 'customer' }
    },
    { 
      id: 'account-support', 
      title: 'Support', 
      description: 'Get help and contact support',
      url: '/account/support', 
      type: 'page',
      metadata: { section: 'customer' },
      criteria: customerAccount?.enabledFeatures?.supportEnabled
    },
  ];

  // Add blog articles from customerDashboardData
  if (customerDashboardData?.allBlogPosts && Array.isArray(customerDashboardData.allBlogPosts)) {
    customerDashboardData.allBlogPosts.forEach((post: any) => {
      if (post && post.id && post.title) {
        pages.push({
          id: `blog-${post.id}`,
          title: post.title,
          description: post.description || 'Blog article from Mapp',
          url: post.url,
          type: 'blog',
          metadata: { 
            section: 'content',
            category: 'Blog',
            author: post.author || 'Mapp',
            publishedAt: post.publishedAt,
            categories: post.categories || [],
            source: 'external'
          },
          criteria: true // Blog posts are always available
        });
      }
    });
  }

  return pages;
}

export async function searchPages(query: string, userRole?: string, data?: { customerAccount: CustomerAccountData | null; customerDashboardData: any | null }): Promise<SearchResponse> {
  // Fetch customer account data inside the function
  const customerAccount = data?.customerAccount || null;
  const customerDashboardData = data?.customerDashboardData || null;

  if (!query.trim()) {
    return {
      results: [],
      total: 0,
      query,
      resultsByType: {}
    };
  }

  const searchTerm = query.toLowerCase().trim();
  
  // Create static pages with current customer data
  const staticPages = createStaticPages(customerAccount, customerDashboardData);
  
  // Filter pages based on user role
  let availablePages = staticPages;
  
  if (userRole === 'customer') {
    // Customer users can see customer, general, and content pages (like blog posts)
    availablePages = staticPages.filter(page => 
      page.metadata?.section === 'customer' || 
      page.metadata?.section === 'general' || 
      page.metadata?.section === 'content'
    );
  } else if (userRole !== 'admin') {
    // Non-authenticated or other users can only see general pages
    availablePages = staticPages.filter(page => page.metadata?.section === 'general');
  }

  // Search through title, description, and metadata
  const matchingPages = availablePages.filter(page => {
    const titleMatch = page.title.toLowerCase().includes(searchTerm);
    const descriptionMatch = page.description?.toLowerCase().includes(searchTerm);
    const urlMatch = page.url.toLowerCase().includes(searchTerm);
    
    // Enhanced matching for blog posts
    let metadataMatch = false;
    if (page.type === 'blog' && page.metadata) {
      const authorMatch = page.metadata.author?.toLowerCase().includes(searchTerm);
      const categoryMatch = page.metadata.category?.toLowerCase().includes(searchTerm);
      const categoriesMatch = page.metadata.categories?.some((cat: string) => 
        cat.toLowerCase().includes(searchTerm)
      );
      metadataMatch = authorMatch || categoryMatch || categoriesMatch;
    }
    
    return titleMatch || descriptionMatch || urlMatch || metadataMatch;
  });

  // Calculate relevance score
  const scoredResults = matchingPages.map(page => {
    let relevance = 0;
    
    // Title exact match gets highest score
    if (page.title.toLowerCase() === searchTerm) relevance += 100;
    else if (page.title.toLowerCase().includes(searchTerm)) relevance += 50;
    
    // Description match
    if (page.description?.toLowerCase().includes(searchTerm)) relevance += 20;
    
    // URL match
    if (page.url.toLowerCase().includes(searchTerm)) relevance += 10;
    
    // Enhanced scoring for blog metadata
    if (page.type === 'blog' && page.metadata) {
      // Author exact match
      if (page.metadata.author?.toLowerCase() === searchTerm) relevance += 60;
      else if (page.metadata.author?.toLowerCase().includes(searchTerm)) relevance += 20;
      
      // Category match
      if (page.metadata.category?.toLowerCase().includes(searchTerm)) relevance += 25;
      
      // Categories array match
      if (page.metadata.categories?.some((cat: string) => 
        cat.toLowerCase() === searchTerm
      )) relevance += 40;
      else if (page.metadata.categories?.some((cat: string) => 
        cat.toLowerCase().includes(searchTerm)
      )) relevance += 15;
      
      // Boost recent blog posts
      if (page.metadata.publishedAt) {
        const publishDate = new Date(page.metadata.publishedAt);
        const daysSincePublish = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSincePublish < 7) relevance += 10; // Recent posts get boost
        else if (daysSincePublish < 30) relevance += 5;
      }
    }
    
    return { ...page, relevance };
  });

  // Sort by relevance
  const sortedResults = scoredResults.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

  // Group by type
  const resultsByType: { [key: string]: SearchResult[] } = {};
  sortedResults.forEach(result => {
    if (!resultsByType[result.type]) {
      resultsByType[result.type] = [];
    }
    resultsByType[result.type].push(result);
  });

  return {
    results: sortedResults,
    total: sortedResults.length,
    query,
    resultsByType
  };
}

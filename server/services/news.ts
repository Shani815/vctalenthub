import NewsAPI from 'newsapi';

const newsApi = new NewsAPI(process.env.NEWS_API_KEY || '');

export interface NewsArticle {
  title: string;
  source: string;
  date: string;
  category: string;
  url: string;
  summary: string;
  imageUrl?: string;
}

export async function getTopStartupNews(): Promise<NewsArticle[]> {
  if (!process.env.NEWS_API_KEY) {
    console.warn('NEWS_API_KEY not found in environment variables, using fallback data');
    return getFallbackNews();
  }

  try {
    const response = await newsApi.v2.everything({
      q: '(startup OR "venture capital" OR VC) AND (funding OR investment OR acquisition)',
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: 3
    });

    return response.articles.map(article => ({
      title: article.title,
      source: article.source.name || '',
      date: article.publishedAt,
      category: getCategoryFromTitle(article.title),
      url: article.url,
      summary: article.description || '',
      imageUrl: article.urlToImage
    }));
  } catch (error) {
    console.error('Error fetching startup news:', error);
    return getFallbackNews();
  }
}

function getCategoryFromTitle(title: string): string {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('funding') || lowerTitle.includes('raises')) {
    return 'Funding';
  } else if (lowerTitle.includes('ipo') || lowerTitle.includes('public')) {
    return 'Markets';
  } else if (lowerTitle.includes('vc') || lowerTitle.includes('venture')) {
    return 'VC News';
  }
  return 'Startup News';
}

function getFallbackNews(): NewsArticle[] {
  const currentDate = new Date().toISOString();
  return [
    {
      title: "AI Startup Raises Record $500M Series A Round",
      source: "TechCrunch",
      date: currentDate,
      category: "Funding",
      url: "https://techcrunch.com/ai-startup-funding",
      summary: "Leading AI startup secures largest Series A funding in tech history",
      imageUrl: "https://images.unsplash.com/photo-1677442136019-21780ecad995"
    },
    {
      title: "Top VC Firm Launches $1B Climate Tech Fund",
      source: "VentureBeat",
      date: currentDate,
      category: "VC News",
      url: "https://venturebeat.com/vc-climate-fund",
      summary: "Major venture capital firm commits to sustainable technology investments",
      imageUrl: "https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9"
    },
    {
      title: "Startup Unicorn Plans IPO in Q2 2025",
      source: "Reuters",
      date: currentDate,
      category: "Markets",
      url: "https://reuters.com/startup-ipo-2025",
      summary: "Fast-growing startup announces plans to go public next year",
      imageUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3"
    }
  ];
}
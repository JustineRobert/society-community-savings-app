import React, { useState, useEffect } from 'react';
import helpService from '../services/helpService';
import './HelpCenter.css';

/**
 * HelpCenter Component
 * Displays knowledge base with articles and search
 */

const HelpCenter = () => {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [articles, setArticles] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    loadCategories();
    loadFeaturedArticles();
  }, []);

  const loadCategories = async () => {
    try {
      const categories = await helpService.getCategories();
      setCategories(Array.isArray(categories) ? categories : []);
      if (Array.isArray(categories) && categories.length > 0) {
        setSelectedCategory(categories[0].id || categories[0]);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const loadFeaturedArticles = async () => {
    try {
      const featured = await helpService.getFeaturedArticles(5);
      setFeatured(Array.isArray(featured) ? featured : []);
    } catch (error) {
      console.error('Error fetching featured articles:', error);
    }
  };

  const fetchArticlesByCategory = async (categoryId) => {
    setLoading(true);
    try {
      const articles = await helpService.getArticlesByCategory(categoryId);
      setArticles(Array.isArray(articles) ? articles : []);
      setSelectedArticle(null);
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchArticle = async (articleId) => {
    try {
      const article = await helpService.getArticle(articleId);
      setSelectedArticle(article);
    } catch (error) {
      console.error('Error fetching article:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (searchQuery.trim().length < 2) return;

    setSearching(true);
    try {
      const results = await helpService.searchArticles(searchQuery);
      setSearchResults(Array.isArray(results) ? results : []);
      setSelectedArticle(null);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleCategoryClick = (categoryId) => {
    setSelectedCategory(categoryId);
    fetchArticlesByCategory(categoryId);
  };

  const handleArticleClick = (articleId) => {
    fetchArticle(articleId);
  };

  const handleFeedback = async (helpful) => {
    if (!selectedArticle) return;

    try {
      if (helpful) {
        await helpService.markArticleHelpful(selectedArticle.id);
      } else {
        await helpService.markArticleUnhelpful(selectedArticle.id);
      }
      alert('Thank you for your feedback!');
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  return (
    <div className="help-center">
      <header className="help-header">
        <h1>Help Center</h1>
        <p>Find answers and learn how to use Community Savings App</p>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="help-search-form">
          <input
            type="text"
            placeholder="Search for help articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" disabled={searching}>
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>
      </header>

      <div className="help-container">
        {/* Featured Articles */}
        {!searchQuery && !selectedArticle && (
          <section className="help-featured">
            <h2>Featured Articles</h2>
            <div className="help-featured-grid">
              {featured.map((article) => (
                <div key={article.id} className="help-featured-card">
                  <h3>{article.title}</h3>
                  <p>{article.summary}</p>
                  <button onClick={() => handleArticleClick(article.id)}>Read More</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Main Content */}
        <div className="help-main">
          {/* Sidebar Categories */}
          {!selectedArticle && !searchQuery && (
            <aside className="help-sidebar">
              <h3>Categories</h3>
              <div className="help-categories">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    className={`help-category-btn ${selectedCategory === category.id ? 'active' : ''}`}
                    onClick={() => handleCategoryClick(category.id)}
                  >
                    <span className="help-icon">{category.icon}</span>
                    <span>{category.name}</span>
                  </button>
                ))}
              </div>
            </aside>
          )}

          {/* Articles List */}
          {!selectedArticle && (
            <div className="help-articles">
              <h2>{searchQuery ? `Search Results for "${searchQuery}"` : 'Articles'}</h2>
              {loading ? (
                <p>Loading articles...</p>
              ) : (searchQuery ? searchResults : articles).length > 0 ? (
                <ul className="help-articles-list">
                  {(searchQuery ? searchResults : articles).map((article) => (
                    <li key={article.id}>
                      <button
                        onClick={() => handleArticleClick(article.id)}
                        className="help-article-link"
                      >
                        <span className="title">{article.title}</span>
                        <span className="views">👁️ {article.views}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No articles found.</p>
              )}
            </div>
          )}
        </div>

        {/* Article View */}
        {selectedArticle && (
          <div className="help-article-view">
            <button onClick={() => setSelectedArticle(null)} className="help-back-btn">
              ← Back to Articles
            </button>

            <article className="help-article">
              <h1>{selectedArticle.title}</h1>
              <div className="help-article-meta">
                <span>By {selectedArticle.author || 'Support Team'}</span>
                <span>👁️ {selectedArticle.views} views</span>
              </div>

              <div className="help-article-content">{selectedArticle.content}</div>

              <div className="help-article-feedback">
                <p>Was this article helpful?</p>
                <button onClick={() => handleFeedback(true)} className="help-yes-btn">
                  👍 Yes
                </button>
                <button onClick={() => handleFeedback(false)} className="help-no-btn">
                  👎 No
                </button>
              </div>
            </article>
          </div>
        )}
      </div>
    </div>
  );
};

export default HelpCenter;

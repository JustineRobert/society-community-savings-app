/**
 * FAQ.jsx
 * Frequently Asked Questions component
 */

import React, { useState, useEffect } from 'react';
import faqService from '../services/faqService';
import './FAQ.css';

function FAQ() {
  const [faqs, setFaqs] = useState([]);
  const [filteredFaqs, setFilteredFaqs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ totalFaqs: 0, totalViews: 0 });

  // Fetch FAQs and categories on mount
  useEffect(() => {
    loadFAQContent();
  }, []);

  // Filter FAQs when category or search changes
  useEffect(() => {
    filterFAQs();
  }, [selectedCategory, searchQuery, faqs]);

  const loadFAQContent = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch categories
      const categoriesData = await faqService.getCategories();
      setCategories(categoriesData);

      // Fetch FAQs
      const faqsData = await faqService.getFAQItems(1, 100);
      setFaqs(faqsData);

      // Fetch stats
      const statsData = await faqService.getFAQStats();
      setStats(statsData);
    } catch (err) {
      setError('Failed to load FAQ content');
      console.error('Error loading FAQs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterFAQs = () => {
    let filtered = [...faqs];

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(faq => faq.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        faq =>
          faq.question.toLowerCase().includes(query) ||
          faq.answer.toLowerCase().includes(query)
      );
    }

    setFilteredFaqs(filtered);
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleCategoryFilter = (category) => {
    setSelectedCategory(category);
  };

  const handleToggleFaq = async (faqId) => {
    setExpandedFaqId(expandedFaqId === faqId ? null : faqId);
    
    if (expandedFaqId !== faqId) {
      try {
        await faqService.incrementFAQViews(faqId);
      } catch (err) {
        console.error('Error incrementing views:', err);
      }
    }
  };

  const handleMarkHelpful = async (faqId, helpful = true) => {
    try {
      if (helpful) {
        await faqService.markFAQHelpful(faqId);
      } else {
        await faqService.markFAQUnhelpful(faqId);
      }

      // Update local state
      setFaqs(faqs.map(faq => 
        faq.id === faqId 
          ? { 
              ...faq, 
              helpful_count: (faq.helpful_count || 0) + (helpful ? 1 : 0),
              unhelpful_count: (faq.unhelpful_count || 0) + (!helpful ? 1 : 0)
            }
          : faq
      ));
    } catch (err) {
      console.error('Error marking FAQ:', err);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedCategory('all');
  };

  const handleRetry = () => {
    loadFAQContent();
  };

  if (loading) {
    return (
      <div className="faq-container">
        <div className="faq-wrapper">
          <div className="faq-header">
            <h1>Frequently Asked Questions</h1>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="faq-container">
        <div className="faq-wrapper">
          <div className="faq-header">
            <h1>Frequently Asked Questions</h1>
            <p>{error}</p>
          </div>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <button onClick={handleRetry} style={{ padding: '10px 20px' }}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="faq-container">
      <div className="faq-wrapper">
        <div className="faq-header">
          <h1>Frequently Asked Questions</h1>
          <p>Find quick answers to common questions</p>
        </div>

        {/* Statistics */}
        <div className="faq-stats">
          <div className="faq-stat">
            <div className="faq-stat-number">{stats.totalFaqs || faqs.length}</div>
            <div className="faq-stat-label">Total FAQs</div>
          </div>
          <div className="faq-stat">
            <div className="faq-stat-number">{stats.totalViews || 0}</div>
            <div className="faq-stat-label">Total Views</div>
          </div>
          <div className="faq-stat">
            <div className="faq-stat-number">{categories.length}</div>
            <div className="faq-stat-label">Categories</div>
          </div>
        </div>

        {/* Search */}
        <div className="faq-search">
          <input
            type="text"
            className="faq-search-input"
            placeholder="Search FAQs..."
            value={searchQuery}
            onChange={handleSearch}
            aria-label="Search FAQs"
          />
        </div>

        {/* Category Filter */}
        <div className="faq-categories">
          <button
            className={`faq-category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => handleCategoryFilter('all')}
          >
            All
          </button>
          {categories.map(category => (
            <button
              key={category.id || category.name}
              className={`faq-category-btn ${selectedCategory === (category.name || category) ? 'active' : ''}`}
              onClick={() => handleCategoryFilter(category.name || category)}
            >
              {category.name || category}
            </button>
          ))}
        </div>

        {/* FAQ Items */}
        {filteredFaqs.length > 0 ? (
          <ul className="faq-items">
            {filteredFaqs.map(faq => (
              <li 
                key={faq.id} 
                className={`faq-item ${expandedFaqId === faq.id ? 'open' : ''}`}
              >
                <button
                  className="faq-question"
                  onClick={() => handleToggleFaq(faq.id)}
                  aria-expanded={expandedFaqId === faq.id}
                >
                  <span className="faq-question-text">{faq.question}</span>
                  <span className="faq-toggle-icon">▼</span>
                </button>
                <div className="faq-answer">
                  <div className="faq-answer-content">
                    {faq.answer}
                    <div className="faq-helpful">
                      <span>Was this helpful?</span>
                      <button
                        className="faq-helpful-btn"
                        onClick={() => handleMarkHelpful(faq.id, true)}
                      >
                        Yes
                      </button>
                      <button
                        className="faq-helpful-btn"
                        onClick={() => handleMarkHelpful(faq.id, false)}
                      >
                        No
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="faq-no-results">
            <div className="faq-no-results-icon">🔍</div>
            <h3>No FAQs Found</h3>
            <p>
              {searchQuery ? 'Try a different search term' : 'No FAQs in this category'}
            </p>
            <button 
              className="faq-no-results-btn"
              onClick={handleClearSearch}
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default FAQ;

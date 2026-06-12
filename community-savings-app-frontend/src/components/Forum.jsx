/**
 * Forum.jsx
 * Community Forum component for discussions
 */

import React, { useState, useEffect } from 'react';
import forumService from '../services/forumService';
import './Forum.css';

function Forum() {
  const [topics, setTopics] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [replies, setReplies] = useState([]);
  const [sortOrder, setSortOrder] = useState('newest');
  const [filterType, setFilterType] = useState('all');
  const [recentTopics, setRecentTopics] = useState([]);
  const [popularTopics, setPopularTopics] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ topics: 0, replies: 0, users: 0 });

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
  });

  useEffect(() => {
    loadForumContent();
  }, [selectedCategory, sortOrder, filterType]);

  const loadForumContent = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch categories
      const categoriesData = await forumService.getCategories();
      setCategories(categoriesData);

      // Fetch topics with current filters
      const options = {
        page: 1,
        limit: 20,
        sort: sortOrder,
        ...(selectedCategory !== 'all' && { category: selectedCategory }),
        ...(filterType !== 'all' && { filter: filterType }),
      };
      const topicsData = await forumService.getTopics(options);
      setTopics(topicsData);

      // Fetch recent and popular topics
      const recent = await forumService.getRecentTopics(5);
      setRecentTopics(recent);

      const popular = await forumService.getPopularTopics(5);
      setPopularTopics(popular);

      // Fetch stats
      const statsData = await forumService.getForumStats();
      setStats(statsData);
    } catch (err) {
      setError('Failed to load forum content');
      console.error('Error loading forum:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryFilter = (category) => {
    setSelectedCategory(category);
  };

  const handleSortChange = (e) => {
    setSortOrder(e.target.value);
  };

  const handleFilterChange = (e) => {
    setFilterType(e.target.value);
  };

  const handleTopicClick = async (topicId) => {
    try {
      const topic = await forumService.getTopic(topicId);
      setSelectedTopic(topic);
      await forumService.incrementTopicViews(topicId);

      // Fetch replies
      const repliesData = await forumService.getTopicReplies(topicId);
      setReplies(repliesData);
    } catch (err) {
      setError('Failed to load topic');
    }
  };

  const handleCreateTopic = async (e) => {
    e.preventDefault();
    try {
      const newTopic = await forumService.createTopic({
        ...formData,
        category: selectedCategory !== 'all' ? selectedCategory : 'general',
      });

      // Reset form and modal
      setFormData({ title: '', content: '' });
      setShowModal(false);

      // Reload topics
      await loadForumContent();
    } catch (err) {
      setError('Failed to create topic');
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRetry = () => {
    loadForumContent();
  };

  if (loading) {
    return (
      <div className="forum-container">
        <div className="forum-wrapper">
          <div className="forum-header">
            <h1>Community Forum</h1>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !selectedTopic) {
    return (
      <div className="forum-container">
        <div className="forum-wrapper">
          <div className="forum-header">
            <h1>Community Forum</h1>
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

  if (selectedTopic) {
    return (
      <div className="forum-container">
        <div className="forum-wrapper">
          <button
            className="help-back-btn"
            onClick={() => setSelectedTopic(null)}
            style={{ marginBottom: '20px' }}
          >
            ← Back to Topics
          </button>

          <div className="forum-content">
            <h1>{selectedTopic.title}</h1>
            <div className="forum-topic-meta">
              <span>By {selectedTopic.author?.name || 'Anonymous'}</span>
              <span>{selectedTopic.views || 0} views</span>
              <span>{replies.length} replies</span>
            </div>
            <div className="help-article-content">{selectedTopic.content}</div>

            {replies.length > 0 && (
              <div style={{ marginTop: '30px' }}>
                <h2>Replies ({replies.length})</h2>
                {replies.map((reply) => (
                  <div
                    key={reply.id}
                    style={{
                      padding: '15px',
                      marginBottom: '10px',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      borderLeft: reply.isSolution ? '4px solid #10b981' : '4px solid #e5e7eb',
                    }}
                  >
                    <p style={{ margin: '0 0 10px 0', fontWeight: '600' }}>
                      {reply.author?.name || 'Anonymous'}
                      {reply.isSolution && ' ✓ Solution'}
                    </p>
                    <p style={{ margin: '0', color: '#4b5563' }}>{reply.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="forum-container">
      <div className="forum-wrapper">
        <div className="forum-header">
          <h1>Community Forum</h1>
          <p>Join the discussion with community members</p>
          <div className="forum-stats">
            <div className="forum-stat">
              <span className="forum-stat-number">{stats.topics || topics.length}</span>
              <span className="forum-stat-label">Topics</span>
            </div>
            <div className="forum-stat">
              <span className="forum-stat-number">{stats.replies || 0}</span>
              <span className="forum-stat-label">Replies</span>
            </div>
            <div className="forum-stat">
              <span className="forum-stat-number">{stats.users || 0}</span>
              <span className="forum-stat-label">Members</span>
            </div>
          </div>
        </div>

        <div className="forum-main">
          {/* Left Sidebar - Categories */}
          <div className="forum-sidebar">
            <h3>Categories</h3>
            <ul className="forum-category-list">
              <li className="forum-category-item">
                <button
                  className={`forum-category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                  onClick={() => handleCategoryFilter('all')}
                >
                  All Categories
                </button>
              </li>
              {categories.map((category) => (
                <li key={category.id || category.name} className="forum-category-item">
                  <button
                    className={`forum-category-btn ${selectedCategory === (category.name || category) ? 'active' : ''}`}
                    onClick={() => handleCategoryFilter(category.name || category)}
                  >
                    {category.name || category}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Main Content */}
          <div className="forum-content">
            <div className="forum-content-header">
              <div className="forum-content-title">
                <h2>
                  {selectedCategory !== 'all'
                    ? `${selectedCategory} Discussions`
                    : 'All Discussions'}
                </h2>
              </div>
              <button className="forum-new-topic-btn" onClick={() => setShowModal(true)}>
                + New Topic
              </button>
            </div>

            <div className="forum-controls">
              <div className="forum-sort">
                <label htmlFor="sort">Sort by:</label>
                <select id="sort" value={sortOrder} onChange={handleSortChange}>
                  <option value="newest">Newest</option>
                  <option value="active">Most Active</option>
                  <option value="viewed">Most Viewed</option>
                </select>
              </div>

              <div className="forum-filter">
                <label htmlFor="filter">Filter:</label>
                <select id="filter" value={filterType} onChange={handleFilterChange}>
                  <option value="all">All Topics</option>
                  <option value="unanswered">Unanswered</option>
                  <option value="solved">Solved</option>
                </select>
              </div>
            </div>

            {topics.length > 0 ? (
              <ul className="forum-topics">
                {topics.map((topic) => (
                  <li
                    key={topic.id}
                    className="forum-topic-item"
                    onClick={() => handleTopicClick(topic.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="forum-topic-icon">
                      {topic.isSolved ? '✓' : topic.replies > 0 ? '💬' : '❓'}
                    </div>
                    <div>
                      <h3>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handleTopicClick(topic.id);
                          }}
                        >
                          {topic.title}
                        </a>
                      </h3>
                      <div className="forum-topic-meta">
                        <span className="forum-topic-author">
                          {topic.author?.name || 'Anonymous'}
                        </span>
                        {topic.tags && topic.tags.length > 0 && (
                          <div className="forum-tags">
                            {topic.tags.map((tag) => (
                              <span key={tag} className="forum-tag">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="forum-topic-stats">
                      <span className="forum-topic-stats-number">{topic.replies || 0}</span>
                      <span className="forum-topic-stats-label">Replies</span>
                    </div>
                    <div className="forum-topic-updated">
                      {new Date(topic.lastUpdated || topic.createdAt).toLocaleDateString()}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="forum-empty">
                <div className="forum-empty-icon">🏜️</div>
                <h3>No Topics Found</h3>
                <p>Be the first to start a discussion!</p>
                <button className="forum-new-topic-btn" onClick={() => setShowModal(true)}>
                  + Create Topic
                </button>
              </div>
            )}
          </div>

          {/* Right Sidebar - Recent/Popular */}
          <div className="forum-sidebar-right">
            <h3>Recent Topics</h3>
            {recentTopics.length > 0 ? (
              <ul>
                {recentTopics.map((topic) => (
                  <li key={topic.id}>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleTopicClick(topic.id);
                      }}
                    >
                      {topic.title}
                    </a>
                    <div className="forum-sidebar-count">{topic.replies || 0} replies</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No recent topics</p>
            )}

            <h3 style={{ marginTop: '20px' }}>Popular Topics</h3>
            {popularTopics.length > 0 ? (
              <ul>
                {popularTopics.map((topic) => (
                  <li key={topic.id}>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleTopicClick(topic.id);
                      }}
                    >
                      {topic.title}
                    </a>
                    <div className="forum-sidebar-count">{topic.views || 0} views</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No popular topics</p>
            )}
          </div>
        </div>
      </div>

      {/* New Topic Modal */}
      <div className={`forum-modal-overlay ${showModal ? 'active' : ''}`}>
        <div className="forum-modal">
          <div className="forum-modal-header">
            <h2>Create New Topic</h2>
            <button className="forum-modal-close" onClick={() => setShowModal(false)}>
              ✕
            </button>
          </div>
          <form onSubmit={handleCreateTopic}>
            <div className="forum-modal-body">
              <div className="forum-form-group">
                <label htmlFor="title">Topic Title *</label>
                <input
                  id="title"
                  type="text"
                  name="title"
                  placeholder="Enter topic title"
                  value={formData.title}
                  onChange={handleFormChange}
                  required
                />
              </div>

              <div className="forum-form-group">
                <label htmlFor="content">Description *</label>
                <textarea
                  id="content"
                  name="content"
                  placeholder="Describe your topic..."
                  value={formData.content}
                  onChange={handleFormChange}
                  required
                />
              </div>
            </div>

            <div className="forum-modal-footer">
              <button
                type="button"
                className="forum-cancel-btn"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className="forum-submit-btn">
                Create Topic
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Forum;

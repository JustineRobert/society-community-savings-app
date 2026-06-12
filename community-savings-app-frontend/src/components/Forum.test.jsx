/**
 * Forum.test.js
 * Unit tests for Forum component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Forum from './Forum';
import forumService from '../services/forumService';

jest.mock('../services/forumService', () => ({
  __esModule: true,
  default: {
    getTopics: jest.fn(),
    getTopic: jest.fn(),
    createTopic: jest.fn(),
    updateTopic: jest.fn(),
    deleteTopic: jest.fn(),
    createReply: jest.fn(),
    updateReply: jest.fn(),
    deleteReply: jest.fn(),
    markSolution: jest.fn(),
    unmarkSolution: jest.fn(),
    markReplyHelpful: jest.fn(),
    markReplyUnhelpful: jest.fn(),
    getForumStats: jest.fn(),
    getTrendingTopics: jest.fn(),
    getPopularTopics: jest.fn(),
    searchTopics: jest.fn(),
    getTopicsByCategory: jest.fn(),
    getRecentTopics: jest.fn(),
    lockTopic: jest.fn(),
    unlockTopic: jest.fn(),
    pinTopic: jest.fn(),
    unpinTopic: jest.fn(),
  },
}));

describe('Forum Component', () => {
  const mockTopics = [
    {
      id: 1,
      title: 'How to use transfers',
      category: 'general',
      author: 'John Doe',
      replies: 5,
      views: 250,
      lastUpdated: new Date('2024-01-15'),
      tags: ['transfers', 'help'],
      isSticky: false,
      isSolved: false,
    },
    {
      id: 2,
      title: 'Account security tips',
      category: 'security',
      author: 'Jane Smith',
      replies: 12,
      views: 400,
      lastUpdated: new Date('2024-01-14'),
      tags: ['security', 'tips'],
      isSticky: true,
      isSolved: false,
    },
    {
      id: 3,
      title: 'Mobile app issues',
      category: 'technical',
      author: 'Bob Johnson',
      replies: 8,
      views: 180,
      lastUpdated: new Date('2024-01-13'),
      tags: ['mobile', 'bug'],
      isSticky: false,
      isSolved: true,
    },
  ];

  const mockCategories = ['general', 'security', 'technical', 'suggestions'];

  beforeEach(() => {
    jest.clearAllMocks();
    forumService.getTopics.mockResolvedValue(mockTopics);
    forumService.getCategories.mockResolvedValue(mockCategories);
  });

  describe('Rendering', () => {
    it('should render forum header', async () => {
      render(<Forum />);
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /community forum/i })).toBeInTheDocument();
      });
    });

    it('should render forum statistics', async () => {
      render(<Forum />);
      await waitFor(() => {
        expect(screen.getByText(/topics/i)).toBeInTheDocument();
        expect(screen.getByText(/replies/i)).toBeInTheDocument();
        expect(screen.getByText(/members/i)).toBeInTheDocument();
      });
    });

    it('should render all topics', async () => {
      render(<Forum />);
      await waitFor(() => {
        mockTopics.forEach((topic) => {
          expect(screen.getByText(topic.title)).toBeInTheDocument();
        });
      });
    });

    it('should render category sidebar', async () => {
      render(<Forum />);
      await waitFor(() => {
        mockCategories.forEach((category) => {
          expect(
            screen.getByRole('button', { name: new RegExp(category, 'i') })
          ).toBeInTheDocument();
        });
      });
    });

    it('should render new topic button', async () => {
      render(<Forum />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new topic/i })).toBeInTheDocument();
      });
    });

    it('should render sort and filter controls', async () => {
      render(<Forum />);
      await waitFor(() => {
        expect(screen.getByDisplayValue(/newest/i)).toBeInTheDocument();
      });
    });
  });

  describe('Topic Display', () => {
    it('should display topic metadata', async () => {
      render(<Forum />);
      await waitFor(() => {
        expect(screen.getByText(mockTopics[0].author)).toBeInTheDocument();
        expect(screen.getByText(new RegExp(mockTopics[0].replies.toString()))).toBeInTheDocument();
      });
    });

    it('should display topic tags', async () => {
      render(<Forum />);
      await waitFor(() => {
        mockTopics[0].tags.forEach((tag) => {
          expect(screen.getByText(tag)).toBeInTheDocument();
        });
      });
    });

    it('should indicate sticky topics', async () => {
      render(<Forum />);
      await waitFor(() => {
        const stickyTag = screen.getAllByText(/sticky/i)[0];
        expect(stickyTag).toBeInTheDocument();
      });
    });

    it('should indicate solved topics', async () => {
      render(<Forum />);
      await waitFor(() => {
        const solvedTag = screen.getAllByText(/solved/i)[0];
        expect(solvedTag).toBeInTheDocument();
      });
    });
  });

  describe('Category Filtering', () => {
    it('should filter topics by category', async () => {
      const filteredTopics = mockTopics.filter((t) => t.category === 'security');
      forumService.getTopicsByCategory.mockResolvedValue(filteredTopics);

      render(<Forum />);

      const categoryButton = await screen.findByRole('button', { name: /security/i });
      fireEvent.click(categoryButton);

      await waitFor(() => {
        expect(forumService.getTopicsByCategory).toHaveBeenCalledWith('security');
      });
    });

    it('should highlight selected category', async () => {
      render(<Forum />);

      const categoryButton = await screen.findByRole('button', { name: /security/i });
      fireEvent.click(categoryButton);

      await waitFor(() => {
        expect(categoryButton).toHaveClass('active');
      });
    });

    it('should show all categories when Reset is clicked', async () => {
      render(<Forum />);

      const categoryButton = await screen.findByRole('button', { name: /general/i });
      fireEvent.click(categoryButton);

      await waitFor(() => {
        expect(categoryButton).toHaveClass('active');
      });

      const resetButton = screen.getByRole('button', { name: /all categories/i });
      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(categoryButton).not.toHaveClass('active');
      });
    });
  });

  describe('Sorting', () => {
    it('should sort topics by newest first', async () => {
      forumService.getTopics.mockResolvedValue([mockTopics[0], mockTopics[1], mockTopics[2]]);

      render(<Forum />);

      const sortSelect = await screen.findByDisplayValue(/newest/i);
      expect(sortSelect.value).toBe('newest');
    });

    it('should sort topics by most active', async () => {
      const sortedTopics = [...mockTopics].sort((a, b) => b.replies - a.replies);
      forumService.getTopics.mockResolvedValue(sortedTopics);

      render(<Forum />);

      const sortSelect = await screen.findByDisplayValue(/newest/i);
      await userEvent.selectOption(sortSelect, 'active');

      await waitFor(() => {
        expect(forumService.getTopics).toHaveBeenCalledWith({ sort: 'active' });
      });
    });

    it('should sort topics by most viewed', async () => {
      const sortedTopics = [...mockTopics].sort((a, b) => b.views - a.views);
      forumService.getTopics.mockResolvedValue(sortedTopics);

      render(<Forum />);

      const sortSelect = await screen.findByDisplayValue(/newest/i);
      await userEvent.selectOption(sortSelect, 'viewed');

      await waitFor(() => {
        expect(forumService.getTopics).toHaveBeenCalledWith({ sort: 'viewed' });
      });
    });
  });

  describe('Filtering', () => {
    it('should filter to show only unanswered topics', async () => {
      const unansweredTopics = mockTopics.filter((t) => t.replies === 0);
      forumService.getTopics.mockResolvedValue(unansweredTopics);

      render(<Forum />);

      const filterSelect = await screen.findByDisplayValue(/all/i);
      await userEvent.selectOption(filterSelect, 'unanswered');

      await waitFor(() => {
        expect(forumService.getTopics).toHaveBeenCalledWith({ filter: 'unanswered' });
      });
    });

    it('should filter to show only solved topics', async () => {
      const solvedTopics = mockTopics.filter((t) => t.isSolved);
      forumService.getTopics.mockResolvedValue(solvedTopics);

      render(<Forum />);

      const filterSelect = await screen.findByDisplayValue(/all/i);
      await userEvent.selectOption(filterSelect, 'solved');

      await waitFor(() => {
        expect(forumService.getTopics).toHaveBeenCalledWith({ filter: 'solved' });
      });
    });
  });

  describe('New Topic Modal', () => {
    it('should open new topic modal when button is clicked', async () => {
      render(<Forum />);

      const newTopicButton = await screen.findByRole('button', { name: /new topic/i });
      fireEvent.click(newTopicButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create new topic/i })).toBeInTheDocument();
      });
    });

    it('should close modal when close button is clicked', async () => {
      render(<Forum />);

      const newTopicButton = await screen.findByRole('button', { name: /new topic/i });
      fireEvent.click(newTopicButton);

      const closeButton = await screen.findByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByRole('heading', { name: /create new topic/i })
        ).not.toBeInTheDocument();
      });
    });

    it('should submit new topic with form data', async () => {
      forumService.createTopic.mockResolvedValue({ id: 4, title: 'New Topic' });

      render(<Forum />);

      const newTopicButton = await screen.findByRole('button', { name: /new topic/i });
      fireEvent.click(newTopicButton);

      const titleInput = await screen.findByPlaceholderText(/topic title/i);
      const contentInput = screen.getByPlaceholderText(/your message/i);
      const submitButton = screen.getByRole('button', { name: /create topic/i });

      await userEvent.type(titleInput, 'New Discussion');
      await userEvent.type(contentInput, 'This is my discussion');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(forumService.createTopic).toHaveBeenCalledWith({
          title: 'New Discussion',
          content: 'This is my discussion',
        });
      });
    });

    it('should validate required fields', async () => {
      render(<Forum />);

      const newTopicButton = await screen.findByRole('button', { name: /new topic/i });
      fireEvent.click(newTopicButton);

      const submitButton = await screen.findByRole('button', { name: /create topic/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Topic Interaction', () => {
    it('should navigate to topic details when clicked', async () => {
      render(<Forum />);

      const topicLink = await screen.findByText(mockTopics[0].title);
      fireEvent.click(topicLink);

      await waitFor(() => {
        expect(forumService.getTopic).toHaveBeenCalledWith(mockTopics[0].id);
      });
    });

    it('should increment view count when topic is opened', async () => {
      forumService.incrementTopicViews.mockResolvedValue({ success: true });

      render(<Forum />);

      const topicLink = await screen.findByText(mockTopics[0].title);
      fireEvent.click(topicLink);

      await waitFor(() => {
        expect(forumService.incrementTopicViews).toHaveBeenCalledWith(mockTopics[0].id);
      });
    });
  });

  describe('Pagination', () => {
    it('should display pagination controls', async () => {
      render(<Forum />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
      });
    });

    it('should navigate to next page', async () => {
      const page2Topics = [
        { ...mockTopics[0], id: 4 },
        { ...mockTopics[1], id: 5 },
      ];
      forumService.getTopics.mockResolvedValueOnce(mockTopics);
      forumService.getTopics.mockResolvedValueOnce(page2Topics);

      render(<Forum />);

      const nextButton = await screen.findByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(forumService.getTopics).toHaveBeenCalledWith({ page: 2 });
      });
    });

    it('should disable previous button on first page', async () => {
      render(<Forum />);

      const prevButton = await screen.findByRole('button', { name: /previous/i });
      expect(prevButton).toBeDisabled();
    });
  });

  describe('Recent Activities', () => {
    it('should display recent topics in right sidebar', async () => {
      render(<Forum />);
      await waitFor(() => {
        expect(screen.getByText(/recent/i)).toBeInTheDocument();
      });
    });

    it('should display popular topics', async () => {
      render(<Forum />);
      await waitFor(() => {
        expect(screen.getByText(/popular/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle loading errors', async () => {
      forumService.getTopics.mockRejectedValue(new Error('Failed to load'));

      render(<Forum />);

      await waitFor(() => {
        expect(screen.getByText(/error loading topics/i)).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      forumService.getTopics.mockRejectedValueOnce(new Error('Failed to load'));
      forumService.getTopics.mockResolvedValueOnce(mockTopics);

      render(<Forum />);

      const retryButton = await screen.findByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(forumService.getTopics).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading indicator while fetching', () => {
      forumService.getTopics.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockTopics), 1000))
      );

      render(<Forum />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should hide loading indicator when done', async () => {
      render(<Forum />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should render sidebar on desktop', async () => {
      render(<Forum />);
      await waitFor(() => {
        const sidebar = screen.getByRole('complementary');
        expect(sidebar).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      render(<Forum />);

      await waitFor(() => {
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(h1).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      render(<Forum />);

      const newTopicButton = await screen.findByRole('button', { name: /new topic/i });
      newTopicButton.focus();
      expect(newTopicButton).toHaveFocus();

      fireEvent.keyDown(newTopicButton, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create new topic/i })).toBeInTheDocument();
      });
    });
  });
});

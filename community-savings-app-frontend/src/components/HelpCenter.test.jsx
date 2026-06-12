/**
 * HelpCenter.test.js
 * Unit tests for HelpCenter component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HelpCenter from './HelpCenter';
import helpService from '../services/helpService';

jest.mock('../services/helpService', () => ({
  __esModule: true,
  default: {
    getArticles: jest.fn(),
    getCategories: jest.fn(),
    searchArticles: jest.fn(),
    getArticlesByCategory: jest.fn(),
    getArticle: jest.fn(),
    getFeaturedArticles: jest.fn(),
    markArticleHelpful: jest.fn(),
    markArticleUnhelpful: jest.fn(),
    getRelatedArticles: jest.fn(),
    incrementArticleViews: jest.fn(),
    getArticleStats: jest.fn(),
    createArticle: jest.fn(),
    updateArticle: jest.fn(),
    deleteArticle: jest.fn(),
    getHelpStats: jest.fn(),
  },
}));

describe('HelpCenter Component', () => {
  const mockArticles = [
    {
      id: 1,
      title: 'Getting Started',
      category: 'basics',
      content: 'How to get started...',
      views: 150,
      updated: new Date('2024-01-15'),
    },
    {
      id: 2,
      title: 'Account Setup',
      category: 'account',
      content: 'Setting up your account...',
      views: 200,
      updated: new Date('2024-01-10'),
    },
  ];

  const mockCategories = ['basics', 'account', 'transactions', 'security'];

  beforeEach(() => {
    jest.clearAllMocks();
    helpService.getArticles.mockResolvedValue(mockArticles);
    helpService.getCategories.mockResolvedValue(mockCategories);
  });

  describe('Rendering', () => {
    it('should render help center header', async () => {
      render(<HelpCenter />);
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /help center/i })).toBeInTheDocument();
      });
    });

    it('should render search form', async () => {
      render(<HelpCenter />);
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search help/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
      });
    });

    it('should render featured articles section', async () => {
      render(<HelpCenter />);
      await waitFor(() => {
        expect(screen.getByText(/featured articles/i)).toBeInTheDocument();
      });
    });

    it('should render categories in sidebar', async () => {
      render(<HelpCenter />);
      await waitFor(() => {
        mockCategories.forEach((category) => {
          expect(screen.getByText(new RegExp(category, 'i'))).toBeInTheDocument();
        });
      });
    });

    it('should render articles list', async () => {
      render(<HelpCenter />);
      await waitFor(() => {
        mockArticles.forEach((article) => {
          expect(screen.getByText(article.title)).toBeInTheDocument();
        });
      });
    });
  });

  describe('Search Functionality', () => {
    it('should search articles by query', async () => {
      const mockSearchResults = [mockArticles[0]];
      helpService.searchArticles.mockResolvedValue(mockSearchResults);

      render(<HelpCenter />);

      const searchInput = await screen.findByPlaceholderText(/search help/i);
      const searchButton = screen.getByRole('button', { name: /search/i });

      await userEvent.type(searchInput, 'Getting Started');
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(helpService.searchArticles).toHaveBeenCalledWith('Getting Started');
      });
    });

    it('should handle empty search results', async () => {
      helpService.searchArticles.mockResolvedValue([]);

      render(<HelpCenter />);

      const searchInput = await screen.findByPlaceholderText(/search help/i);
      const searchButton = screen.getByRole('button', { name: /search/i });

      await userEvent.type(searchInput, 'nonexistent');
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText(/no articles found/i)).toBeInTheDocument();
      });
    });

    it('should clear search results', async () => {
      render(<HelpCenter />);

      const clearButton = await screen.findByRole('button', { name: /clear/i });
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(screen.getByText(/featured articles/i)).toBeInTheDocument();
      });
    });
  });

  describe('Category Filtering', () => {
    it('should filter articles by category', async () => {
      const mockCategoryArticles = [mockArticles[1]];
      helpService.getArticlesByCategory.mockResolvedValue(mockCategoryArticles);

      render(<HelpCenter />);

      const categoryButton = await screen.findByRole('button', { name: /account/i });
      fireEvent.click(categoryButton);

      await waitFor(() => {
        expect(helpService.getArticlesByCategory).toHaveBeenCalledWith('account');
      });
    });

    it('should highlight selected category', async () => {
      render(<HelpCenter />);

      const categoryButton = await screen.findByRole('button', { name: /basics/i });
      fireEvent.click(categoryButton);

      await waitFor(() => {
        expect(categoryButton).toHaveClass('active');
      });
    });
  });

  describe('Article Viewing', () => {
    it('should display article details when clicked', async () => {
      render(<HelpCenter />);

      const articleLink = await screen.findByText(mockArticles[0].title);
      fireEvent.click(articleLink);

      await waitFor(() => {
        expect(screen.getByText(mockArticles[0].content)).toBeInTheDocument();
      });
    });

    it('should show article metadata', async () => {
      render(<HelpCenter />);

      const articleLink = await screen.findByText(mockArticles[0].title);
      fireEvent.click(articleLink);

      await waitFor(() => {
        expect(screen.getByText(new RegExp(mockArticles[0].views, 'i'))).toBeInTheDocument();
      });
    });

    it('should have back button in article view', async () => {
      render(<HelpCenter />);

      const articleLink = await screen.findByText(mockArticles[0].title);
      fireEvent.click(articleLink);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      });
    });

    it('should return to list when back button is clicked', async () => {
      render(<HelpCenter />);

      const articleLink = await screen.findByText(mockArticles[0].title);
      fireEvent.click(articleLink);

      const backButton = await screen.findByRole('button', { name: /back/i });
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(screen.getByText(/featured articles/i)).toBeInTheDocument();
      });
    });
  });

  describe('Article Feedback', () => {
    it('should allow marking article as helpful', async () => {
      helpService.markArticleHelpful.mockResolvedValue({ success: true });

      render(<HelpCenter />);

      const articleLink = await screen.findByText(mockArticles[0].title);
      fireEvent.click(articleLink);

      const yesButton = await screen.findByRole('button', { name: /yes/i });
      fireEvent.click(yesButton);

      await waitFor(() => {
        expect(helpService.markArticleHelpful).toHaveBeenCalledWith(mockArticles[0].id);
      });
    });

    it('should allow marking article as not helpful', async () => {
      helpService.markArticleUnhelpful.mockResolvedValue({ success: true });

      render(<HelpCenter />);

      const articleLink = await screen.findByText(mockArticles[0].title);
      fireEvent.click(articleLink);

      const noButton = await screen.findByRole('button', { name: /no/i });
      fireEvent.click(noButton);

      await waitFor(() => {
        expect(helpService.markArticleUnhelpful).toHaveBeenCalledWith(mockArticles[0].id);
      });
    });

    it('should show feedback confirmation', async () => {
      helpService.markArticleHelpful.mockResolvedValue({ success: true });

      render(<HelpCenter />);

      const articleLink = await screen.findByText(mockArticles[0].title);
      fireEvent.click(articleLink);

      const yesButton = await screen.findByRole('button', { name: /yes/i });
      fireEvent.click(yesButton);

      await waitFor(() => {
        expect(screen.getByText(/thank you for your feedback/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle loading errors', async () => {
      helpService.getArticles.mockRejectedValue(new Error('Failed to load'));

      render(<HelpCenter />);

      await waitFor(() => {
        expect(screen.getByText(/error loading articles/i)).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      helpService.getArticles.mockRejectedValueOnce(new Error('Failed to load'));
      helpService.getArticles.mockResolvedValueOnce(mockArticles);

      render(<HelpCenter />);

      const retryButton = await screen.findByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(helpService.getArticles).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading indicator while fetching', () => {
      helpService.getArticles.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockArticles), 1000))
      );

      render(<HelpCenter />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should hide loading indicator when done', async () => {
      render(<HelpCenter />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      render(<HelpCenter />);

      await waitFor(() => {
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(h1).toBeInTheDocument();
      });
    });

    it('should have descriptive labels for form inputs', async () => {
      render(<HelpCenter />);

      const searchInput = await screen.findByPlaceholderText(/search help/i);
      expect(searchInput).toHaveAttribute('aria-label');
    });

    it('should support keyboard navigation', async () => {
      render(<HelpCenter />);

      const searchButton = await screen.findByRole('button', { name: /search/i });
      searchButton.focus();
      expect(searchButton).toHaveFocus();
    });
  });
});

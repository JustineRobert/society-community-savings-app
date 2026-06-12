/**
 * FAQ.test.js
 * Unit tests for FAQ component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FAQ from './FAQ';
import faqService from '../services/faqService';

jest.mock('../services/faqService', () => ({
  __esModule: true,
  default: {
    getFAQItems: jest.fn(),
    getCategories: jest.fn(),
    searchFAQ: jest.fn(),
    getFAQsByCategory: jest.fn(),
    markFAQHelpful: jest.fn(),
    markFAQUnhelpful: jest.fn(),
    getPopularFAQs: jest.fn(),
    getFAQStats: jest.fn(),
    createFAQ: jest.fn(),
    updateFAQ: jest.fn(),
    deleteFAQ: jest.fn(),
    bulkImportFAQs: jest.fn(),
    exportFAQs: jest.fn(),
  },
}));

describe('FAQ Component', () => {
  const mockFAQItems = [
    {
      id: 1,
      question: 'How do I create an account?',
      answer: 'To create an account, click the sign up button...',
      category: 'account',
      views: 250,
      helpful: 180,
    },
    {
      id: 2,
      question: 'How do I reset my password?',
      answer: 'To reset your password, go to login and click forgot password...',
      category: 'account',
      views: 200,
      helpful: 150,
    },
    {
      id: 3,
      question: 'How do I transfer money?',
      answer: 'To transfer money, go to your dashboard...',
      category: 'transactions',
      views: 300,
      helpful: 220,
    },
  ];

  const mockCategories = ['account', 'transactions', 'security', 'general'];

  beforeEach(() => {
    jest.clearAllMocks();
    faqService.getFAQItems.mockResolvedValue(mockFAQItems);
    faqService.getCategories.mockResolvedValue(mockCategories);
  });

  describe('Rendering', () => {
    it('should render FAQ header', async () => {
      render(<FAQ />);
      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /frequently asked questions/i })
        ).toBeInTheDocument();
      });
    });

    it('should render all FAQ items', async () => {
      render(<FAQ />);
      await waitFor(() => {
        mockFAQItems.forEach((item) => {
          expect(screen.getByText(item.question)).toBeInTheDocument();
        });
      });
    });

    it('should render category filters', async () => {
      render(<FAQ />);
      await waitFor(() => {
        mockCategories.forEach((category) => {
          expect(
            screen.getByRole('button', { name: new RegExp(category, 'i') })
          ).toBeInTheDocument();
        });
      });
    });

    it('should render search input', async () => {
      render(<FAQ />);
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search faqs/i)).toBeInTheDocument();
      });
    });

    it('should render statistics', async () => {
      render(<FAQ />);
      await waitFor(() => {
        expect(screen.getByText(/frequently asked questions/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accordion Functionality', () => {
    it('should toggle FAQ item on click', async () => {
      render(<FAQ />);

      const question = await screen.findByText(mockFAQItems[0].question);
      const faqItem = question.closest('.faq-item');

      fireEvent.click(question);

      await waitFor(() => {
        expect(faqItem).toHaveClass('open');
      });
    });

    it('should show answer when expanded', async () => {
      render(<FAQ />);

      const question = await screen.findByText(mockFAQItems[0].question);
      fireEvent.click(question);

      await waitFor(() => {
        expect(screen.getByText(mockFAQItems[0].answer)).toBeVisible();
      });
    });

    it('should hide answer when collapsed', async () => {
      render(<FAQ />);

      const question = await screen.findByText(mockFAQItems[0].question);
      fireEvent.click(question);

      await waitFor(() => {
        expect(screen.getByText(mockFAQItems[0].answer)).toBeVisible();
      });

      fireEvent.click(question);

      await waitFor(() => {
        expect(screen.getByText(mockFAQItems[0].answer)).not.toBeVisible();
      });
    });

    it('should allow only one item open at a time (if single expansion)', async () => {
      render(<FAQ />);

      const question1 = await screen.findByText(mockFAQItems[0].question);
      const question2 = screen.getByText(mockFAQItems[1].question);

      fireEvent.click(question1);

      await waitFor(() => {
        expect(question1.closest('.faq-item')).toHaveClass('open');
      });

      fireEvent.click(question2);

      await waitFor(() => {
        expect(question1.closest('.faq-item')).not.toHaveClass('open');
        expect(question2.closest('.faq-item')).toHaveClass('open');
      });
    });
  });

  describe('Search Functionality', () => {
    it('should filter FAQs by search query', async () => {
      faqService.searchFAQ.mockResolvedValue([mockFAQItems[0]]);

      render(<FAQ />);

      const searchInput = await screen.findByPlaceholderText(/search faqs/i);
      await userEvent.type(searchInput, 'account');

      await waitFor(() => {
        expect(faqService.searchFAQ).toHaveBeenCalledWith('account');
      });
    });

    it('should handle empty search results', async () => {
      faqService.searchFAQ.mockResolvedValue([]);

      render(<FAQ />);

      const searchInput = await screen.findByPlaceholderText(/search faqs/i);
      await userEvent.type(searchInput, 'nonexistent query');

      await waitFor(() => {
        expect(screen.getByText(/no faqs found/i)).toBeInTheDocument();
      });
    });

    it('should clear search on input clear', async () => {
      render(<FAQ />);

      const searchInput = await screen.findByPlaceholderText(/search faqs/i);
      await userEvent.type(searchInput, 'test');
      await userEvent.clear(searchInput);

      await waitFor(() => {
        mockFAQItems.forEach((item) => {
          expect(screen.getByText(item.question)).toBeInTheDocument();
        });
      });
    });
  });

  describe('Category Filtering', () => {
    it('should filter FAQs by category', async () => {
      const accountFAQs = mockFAQItems.filter((item) => item.category === 'account');
      faqService.getFAQsByCategory.mockResolvedValue(accountFAQs);

      render(<FAQ />);

      const categoryButton = await screen.findByRole('button', { name: /account/i });
      fireEvent.click(categoryButton);

      await waitFor(() => {
        expect(faqService.getFAQsByCategory).toHaveBeenCalledWith('account');
      });
    });

    it('should highlight active category', async () => {
      render(<FAQ />);

      const categoryButton = await screen.findByRole('button', { name: /account/i });
      fireEvent.click(categoryButton);

      await waitFor(() => {
        expect(categoryButton).toHaveClass('active');
      });
    });

    it('should reset filter when all categories button is clicked', async () => {
      render(<FAQ />);

      let categoryButton = await screen.findByRole('button', { name: /account/i });
      fireEvent.click(categoryButton);

      await waitFor(() => {
        expect(categoryButton).toHaveClass('active');
      });

      const allButton = screen.getByRole('button', { name: /all/i });
      fireEvent.click(allButton);

      await waitFor(() => {
        expect(categoryButton).not.toHaveClass('active');
      });
    });
  });

  describe('Helpful Feedback', () => {
    it('should allow marking FAQ as helpful', async () => {
      faqService.markFAQHelpful.mockResolvedValue({ success: true });

      render(<FAQ />);

      const question = await screen.findByText(mockFAQItems[0].question);
      fireEvent.click(question);

      const yesButton = await screen.findByRole('button', { name: /yes/i });
      fireEvent.click(yesButton);

      await waitFor(() => {
        expect(faqService.markFAQHelpful).toHaveBeenCalledWith(mockFAQItems[0].id);
      });
    });

    it('should allow marking FAQ as not helpful', async () => {
      faqService.markFAQUnhelpful.mockResolvedValue({ success: true });

      render(<FAQ />);

      const question = await screen.findByText(mockFAQItems[0].question);
      fireEvent.click(question);

      const noButton = await screen.findByRole('button', { name: /no/i });
      fireEvent.click(noButton);

      await waitFor(() => {
        expect(faqService.markFAQUnhelpful).toHaveBeenCalledWith(mockFAQItems[0].id);
      });
    });

    it('should highlight selected feedback option', async () => {
      render(<FAQ />);

      const question = await screen.findByText(mockFAQItems[0].question);
      fireEvent.click(question);

      const yesButton = await screen.findByRole('button', { name: /yes/i });
      fireEvent.click(yesButton);

      await waitFor(() => {
        expect(yesButton).toHaveClass('active');
      });
    });
  });

  describe('Statistics Display', () => {
    it('should display total FAQ count', async () => {
      render(<FAQ />);
      await waitFor(() => {
        expect(screen.getByText(new RegExp(mockFAQItems.length.toString()))).toBeInTheDocument();
      });
    });

    it('should display view count for each FAQ', async () => {
      render(<FAQ />);

      const question = await screen.findByText(mockFAQItems[0].question);
      fireEvent.click(question);

      await waitFor(() => {
        expect(screen.getByText(new RegExp(mockFAQItems[0].views.toString()))).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle loading errors', async () => {
      faqService.getFAQItems.mockRejectedValue(new Error('Failed to load'));

      render(<FAQ />);

      await waitFor(() => {
        expect(screen.getByText(/error loading faqs/i)).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      faqService.getFAQItems.mockRejectedValueOnce(new Error('Failed to load'));
      faqService.getFAQItems.mockResolvedValueOnce(mockFAQItems);

      render(<FAQ />);

      const retryButton = await screen.findByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(faqService.getFAQItems).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading indicator while fetching', () => {
      faqService.getFAQItems.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockFAQItems), 1000))
      );

      render(<FAQ />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should hide loading indicator when done', async () => {
      render(<FAQ />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for accordion', async () => {
      render(<FAQ />);

      const question = await screen.findByText(mockFAQItems[0].question);
      expect(question).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(question);

      await waitFor(() => {
        expect(question).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('should support keyboard navigation', async () => {
      render(<FAQ />);

      const question = await screen.findByText(mockFAQItems[0].question);
      question.focus();
      expect(question).toHaveFocus();

      fireEvent.keyDown(question, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(question.closest('.faq-item')).toHaveClass('open');
      });
    });

    it('should have proper heading hierarchy', async () => {
      render(<FAQ />);

      await waitFor(() => {
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(h1).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should handle large number of FAQs efficiently', async () => {
      const largeFAQList = Array.from({ length: 100 }, (_, i) => ({
        ...mockFAQItems[0],
        id: i,
        question: `Question ${i}`,
      }));

      faqService.getFAQItems.mockResolvedValue(largeFAQList);

      const { rerender } = render(<FAQ />);

      await waitFor(() => {
        expect(screen.getByText('Question 0')).toBeInTheDocument();
      });

      // Should not cause performance issues
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });
});

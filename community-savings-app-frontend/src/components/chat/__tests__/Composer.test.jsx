/**
 * ============================================================================
 * Composer.test.jsx
 * ============================================================================
 * Enterprise Test Suite for TITechChat Composer
 * ============================================================================
 */

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Composer from '../Composer';

describe('Composer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Message Sending', () => {
    it('blocks empty submission', async () => {
      const onSend = jest.fn();

      render(<Composer onSend={onSend} />);

      const button = screen.getByRole('button', {
        name: /send/i,
      });

      fireEvent.click(button);

      expect(onSend).not.toHaveBeenCalled();
    });

    it('sends trimmed text', async () => {
      const onSend = jest.fn().mockResolvedValue();

      render(<Composer onSend={onSend} />);

      const input =
        screen.getByLabelText(
          /message input/i
        );

      await userEvent.type(
        input,
        '   Hello World   '
      );

      fireEvent.keyDown(input, {
        key: 'Enter',
        code: 'Enter',
      });

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith(
          'Hello World',
          []
        );
      });
    });

    it('clears input after successful send', async () => {
      const onSend =
        jest.fn().mockResolvedValue();

      render(<Composer onSend={onSend} />);

      const input =
        screen.getByLabelText(
          /message input/i
        );

      await userEvent.type(
        input,
        'Hello'
      );

      fireEvent.keyDown(input, {
        key: 'Enter',
      });

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('supports button send', async () => {
      const onSend =
        jest.fn().mockResolvedValue();

      render(<Composer onSend={onSend} />);

      const input =
        screen.getByLabelText(
          /message input/i
        );

      await userEvent.type(
        input,
        'Hello'
      );

      const button =
        screen.getByRole('button', {
          name: /send/i,
        });

      await userEvent.click(button);

      await waitFor(() => {
        expect(onSend).toHaveBeenCalled();
      });
    });
  });

  describe('Keyboard Handling', () => {
    it('does not submit on Shift+Enter', async () => {
      const onSend =
        jest.fn().mockResolvedValue();

      render(<Composer onSend={onSend} />);

      const input =
        screen.getByLabelText(
          /message input/i
        );

      await userEvent.type(
        input,
        'Hello'
      );

      fireEvent.keyDown(input, {
        key: 'Enter',
        shiftKey: true,
      });

      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe('Attachments', () => {
    it('accepts valid attachment', async () => {
      const onSend =
        jest.fn().mockResolvedValue();

      render(
        <Composer
          onSend={onSend}
          allowAttachments
        />
      );

      const input =
        screen.getByLabelText(
          /attach files/i
        );

      const file = new File(
        ['hello'],
        'hello.pdf',
        {
          type: 'application/pdf',
        }
      );

      await userEvent.upload(
        input,
        file
      );

      expect(
        screen.getByText(
          'hello.pdf'
        )
      ).toBeInTheDocument();
    });

    it('rejects invalid mime types', async () => {
      render(
        <Composer
          onSend={() =>
            Promise.resolve()
          }
          allowAttachments
        />
      );

      const input =
        screen.getByLabelText(
          /attach files/i
        );

      const badFile = new File(
        ['x'],
        'virus.exe',
        {
          type:
            'application/x-msdownload',
        }
      );

      await userEvent.upload(
        input,
        badFile
      );

      expect(
        await screen.findByRole(
          'alert'
        )
      ).toHaveTextContent(
        /not allowed/i
      );
    });

    it('rejects oversized files', async () => {
      render(
        <Composer
          onSend={() =>
            Promise.resolve()
          }
          maxFileSize={100}
          allowAttachments
        />
      );

      const input =
        screen.getByLabelText(
          /attach files/i
        );

      const file = new File(
        [new ArrayBuffer(500)],
        'large.pdf',
        {
          type: 'application/pdf',
        }
      );

      await userEvent.upload(
        input,
        file
      );

      expect(
        await screen.findByRole(
          'alert'
        )
      ).toHaveTextContent(
        /exceeds/i
      );
    });

    it('clears attachments', async () => {
      render(
        <Composer
          onSend={() =>
            Promise.resolve()
          }
          allowAttachments
        />
      );

      const input =
        screen.getByLabelText(
          /attach files/i
        );

      const file = new File(
        ['test'],
        'file.pdf',
        {
          type: 'application/pdf',
        }
      );

      await userEvent.upload(
        input,
        file
      );

      expect(
        screen.getByText(
          'file.pdf'
        )
      ).toBeInTheDocument();

      const clearButton =
        screen.getByRole(
          'button',
          {
            name: /clear/i,
          }
        );

      await userEvent.click(
        clearButton
      );

      expect(
        screen.queryByText(
          'file.pdf'
        )
      ).not.toBeInTheDocument();
    });
  });

  describe('Typing Indicators', () => {
    jest.useFakeTimers();

    it('fires typing start', async () => {
      const onTypingStart =
        jest.fn();

      render(
        <Composer
          onSend={() =>
            Promise.resolve()
          }
          onTypingStart={
            onTypingStart
          }
        />
      );

      const input =
        screen.getByLabelText(
          /message input/i
        );

      await userEvent.type(
        input,
        'h'
      );

      expect(
        onTypingStart
      ).toHaveBeenCalled();
    });

    it('fires typing stop after debounce', async () => {
      const onTypingStop =
        jest.fn();

      render(
        <Composer
          onSend={() =>
            Promise.resolve()
          }
          onTypingStop={
            onTypingStop
          }
        />
      );

      const input =
        screen.getByLabelText(
          /message input/i
        );

      await userEvent.type(
        input,
        'hello'
      );

      jest.advanceTimersByTime(
        3000
      );

      expect(
        onTypingStop
      ).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('shows send error', async () => {
      const onSend = jest
        .fn()
        .mockRejectedValue(
          new Error(
            'Failed to send'
          )
        );

      render(
        <Composer
          onSend={onSend}
        />
      );

      const input =
        screen.getByLabelText(
          /message input/i
        );

      await userEvent.type(
        input,
        'hello'
      );

      fireEvent.keyDown(input, {
        key: 'Enter',
      });

      expect(
        await screen.findByRole(
          'alert'
        )
      ).toHaveTextContent(
        'Failed to send'
      );
    });
  });

  describe('Loading State', () => {
    it('shows sending state', async () => {
      let resolveFn;

      const promise =
        new Promise((resolve) => {
          resolveFn = resolve;
        });

      const onSend =
        jest.fn(
          () => promise
        );

      render(
        <Composer
          onSend={onSend}
        />
      );

      const input =
        screen.getByLabelText(
          /message input/i
        );

      await userEvent.type(
        input,
        'hello'
      );

      fireEvent.keyDown(input, {
        key: 'Enter',
      });

      expect(
        screen.getByText(
          /sending/i
        )
      ).toBeInTheDocument();

      resolveFn();

      await waitFor(() => {
        expect(
          screen.getByText(
            /send/i
          )
        ).toBeInTheDocument();
      });
    });
  });
});
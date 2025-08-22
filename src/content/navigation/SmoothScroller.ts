/**
 * SmoothScroller Module
 *
 * Implements smooth scrolling and visual feedback using native browser APIs.
 * Provides hardware-accelerated scrolling with optimal performance and
 * visual highlight animations for bookmark navigation.
 */

import { ScrollOptions } from '../../types/bookmark';

interface SmoothScrollerConfig {
  /** Duration of highlight animations in milliseconds */
  highlightDuration?: number;

  /** Scroll offset from viewport edges */
  scrollOffset?: number;

  /** Custom CSS class for highlights */
  highlightClass?: string;

  /** Enable Intersection Observer for scroll completion detection */
  useIntersectionObserver?: boolean;

  /** Enable smooth scrolling animations */
  enableSmoothScrolling?: boolean;
}

export class SmoothScroller {
  private config: SmoothScrollerConfig &
    Required<
      Pick<
        SmoothScrollerConfig,
        | 'highlightDuration'
        | 'scrollOffset'
        | 'highlightClass'
        | 'useIntersectionObserver'
        | 'enableSmoothScrolling'
      >
    >;
  private intersectionObserver?: IntersectionObserver;
  private highlightTimeouts: Map<Element, ReturnType<typeof setTimeout>> =
    new Map();

  // Performance tracking
  private scrollStartTime: number = 0;
  private animationFrameId?: number;

  constructor(config: SmoothScrollerConfig = {}) {
    this.config = {
      highlightDuration: 3000,
      scrollOffset: 100,
      highlightClass: 'chatmarks-highlight-flash',
      useIntersectionObserver: true,
      enableSmoothScrolling: true,
      ...config,
    };

    this.setupIntersectionObserver();
    this.injectHighlightStyles();
  }

  /**
   * Sets up Intersection Observer for efficient scroll completion detection.
   */
  private setupIntersectionObserver(): void {
    if (
      !this.config.useIntersectionObserver ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Element is in viewport - scroll animation likely complete
            const element = entry.target;
            this.onScrollComplete(element);
          }
        });
      },
      {
        // Trigger when element is fully visible with some margin
        rootMargin: `${this.config.scrollOffset}px`,
        threshold: [0.5, 1.0],
      }
    );
  }

  /**
   * Injects CSS styles for highlight animations.
   */
  private injectHighlightStyles(): void {
    const styleId = 'chatmarks-smooth-scroller-styles';

    // Check if styles already exist
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .${this.config.highlightClass} {
        position: relative;
        transition: all 0.3s ease-in-out;
        z-index: 1000;
      }
      
      .${this.config.highlightClass}::before {
        content: '';
        position: absolute;
        top: -4px;
        left: -4px;
        right: -4px;
        bottom: -4px;
        background: rgba(255, 235, 59, 0.3);
        border: 2px solid #ffeb3b;
        border-radius: 4px;
        pointer-events: none;
        animation: chatmarks-highlight-pulse 0.6s ease-in-out;
        z-index: -1;
      }
      
      @keyframes chatmarks-highlight-pulse {
        0% {
          transform: scale(1);
          opacity: 0;
          background: rgba(255, 235, 59, 0.6);
        }
        50% {
          transform: scale(1.02);
          opacity: 1;
          background: rgba(255, 235, 59, 0.4);
        }
        100% {
          transform: scale(1);
          opacity: 1;
          background: rgba(255, 235, 59, 0.2);
        }
      }
      
      .${this.config.highlightClass}-fade-out::before {
        animation: chatmarks-highlight-fade-out 0.5s ease-in-out forwards;
      }
      
      @keyframes chatmarks-highlight-fade-out {
        0% {
          opacity: 1;
        }
        100% {
          opacity: 0;
          transform: scale(1);
        }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Scrolls smoothly to an element with optimal positioning.
   *
   * @param element - The target element to scroll to
   * @param options - Scroll behavior options
   * @returns Promise that resolves when scrolling completes
   */
  async scrollToElement(
    element: Element | null,
    options: ScrollOptions = {}
  ): Promise<void> {
    if (!element) {
      console.warn('SmoothScroller: Cannot scroll to null element');
      return;
    }

    this.scrollStartTime = performance.now();

    const scrollOptions: ScrollIntoViewOptions = {
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
      ...options,
    };

    return new Promise(resolve => {
      // Set up scroll completion detection
      let scrollCompleted = false;

      const completeScrolling = () => {
        if (scrollCompleted) return;
        scrollCompleted = true;

        const duration = performance.now() - this.scrollStartTime;
        console.debug('SmoothScroller: Scroll completed in', duration, 'ms');

        if (this.intersectionObserver) {
          this.intersectionObserver.unobserve(element);
        }

        resolve();
      };

      // Start observing for intersection (scroll completion)
      if (this.intersectionObserver) {
        this.intersectionObserver.observe(element);
      }

      // Fallback timeout for scroll completion
      const fallbackTimeout = setTimeout(() => {
        completeScrolling();
      }, 1000); // 1 second max scroll time

      // Store completion callback for intersection observer
      (element as any).__scrollCompletionCallback = () => {
        clearTimeout(fallbackTimeout);
        completeScrolling();
      };

      // Perform the actual scroll
      try {
        element.scrollIntoView(scrollOptions);
      } catch (error) {
        console.warn(
          'SmoothScroller: scrollIntoView failed, using fallback:',
          error
        );
        this.fallbackScrollToElement(element);
        completeScrolling();
      }
    });
  }

  /**
   * Fallback scroll implementation using manual positioning.
   *
   * @param element - The target element
   */
  private fallbackScrollToElement(element: Element): void {
    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const targetY = scrollTop + rect.top - window.innerHeight / 2;

    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: 'smooth',
    });
  }

  /**
   * Calculates the optimal scroll position for an element.
   *
   * @param element - The target element
   * @returns The optimal scroll Y position
   */
  calculateOptimalScrollPosition(element: Element | null): number {
    if (!element) {
      return 0;
    }

    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // Center element in viewport with offset
    const targetY =
      scrollTop + rect.top - window.innerHeight / 2 + this.config.scrollOffset;

    return Math.max(
      0,
      Math.min(targetY, document.body.scrollHeight - window.innerHeight)
    );
  }

  /**
   * Animates a highlight effect on an element.
   *
   * @param element - The element to highlight
   * @returns Promise that resolves when animation completes
   */
  async animateHighlight(element: Element | null): Promise<void> {
    if (!element) {
      return;
    }

    return new Promise(resolve => {
      // Clear any existing highlight timeout
      const existingTimeout = this.highlightTimeouts.get(element);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.highlightTimeouts.delete(element);
      }

      // Remove existing highlight classes
      element.classList.remove(this.config.highlightClass);
      element.classList.remove(`${this.config.highlightClass}-fade-out`);

      // Force reflow to ensure class removal takes effect
      void (element as HTMLElement).offsetHeight;

      // Add highlight class
      element.classList.add(this.config.highlightClass);

      // Set up fade-out animation
      const fadeOutTimeout = setTimeout(() => {
        element.classList.add(`${this.config.highlightClass}-fade-out`);

        // Remove all highlight classes after fade-out completes
        const cleanupTimeout = setTimeout(() => {
          element.classList.remove(this.config.highlightClass);
          element.classList.remove(`${this.config.highlightClass}-fade-out`);
          this.highlightTimeouts.delete(element);
          resolve();
        }, 500); // Fade-out animation duration

        this.highlightTimeouts.set(element, cleanupTimeout);
      }, this.config.highlightDuration - 500);

      this.highlightTimeouts.set(element, fadeOutTimeout);
    });
  }

  /**
   * Called when scroll completion is detected via Intersection Observer.
   *
   * @param element - The element that became visible
   */
  private onScrollComplete(element: Element): void {
    const callback = (element as any).__scrollCompletionCallback;
    if (callback) {
      callback();
      delete (element as any).__scrollCompletionCallback;
    }
  }

  /**
   * Scrolls to a specific Y position with smooth animation.
   *
   * @param targetY - The target scroll position
   * @returns Promise that resolves when scrolling completes
   */
  async scrollToPosition(targetY: number): Promise<void> {
    return new Promise(resolve => {
      const startY = window.pageYOffset;
      const distance = targetY - startY;
      const startTime = performance.now();
      const duration = Math.min(Math.abs(distance) / 2, 500); // Max 500ms

      const animateScroll = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-in-out)
        const easedProgress =
          progress < 0.5
            ? 2 * progress * progress
            : -1 + (4 - 2 * progress) * progress;

        const currentY = startY + distance * easedProgress;
        window.scrollTo(0, currentY);

        if (progress < 1) {
          this.animationFrameId = requestAnimationFrame(animateScroll);
        } else {
          resolve();
        }
      };

      this.animationFrameId = requestAnimationFrame(animateScroll);
    });
  }

  /**
   * Checks if an element is currently visible in the viewport.
   *
   * @param element - The element to check
   * @returns True if element is visible
   */
  isElementVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    const windowHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const windowWidth =
      window.innerWidth || document.documentElement.clientWidth;

    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= windowHeight &&
      rect.right <= windowWidth
    );
  }

  /**
   * Gets the distance of an element from the current viewport.
   *
   * @param element - The element to measure
   * @returns Distance in pixels (0 if in viewport)
   */
  getDistanceFromViewport(element: Element): number {
    const rect = element.getBoundingClientRect();
    const windowHeight =
      window.innerHeight || document.documentElement.clientHeight;

    if (rect.bottom < 0) {
      // Element is above viewport
      return Math.abs(rect.bottom);
    } else if (rect.top > windowHeight) {
      // Element is below viewport
      return rect.top - windowHeight;
    } else {
      // Element is in viewport
      return 0;
    }
  }

  /**
   * Gets performance metrics for scrolling operations.
   *
   * @returns Scrolling performance information
   */
  getPerformanceMetrics(): {
    lastScrollDuration?: number;
    activeHighlights: number;
  } {
    return {
      lastScrollDuration: this.scrollStartTime
        ? performance.now() - this.scrollStartTime
        : undefined,
      activeHighlights: this.highlightTimeouts.size,
    };
  }

  /**
   * Cleans up resources and timers.
   */
  cleanup(): void {
    // Clear all highlight timeouts
    this.highlightTimeouts.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    this.highlightTimeouts.clear();

    // Cancel any ongoing animation
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Disconnect intersection observer
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    // Remove injected styles
    const styleElement = document.getElementById(
      'chatmarks-smooth-scroller-styles'
    );
    if (styleElement) {
      styleElement.remove();
    }
  }
}

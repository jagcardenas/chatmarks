/**
 * ThemeManager Module
 *
 * Manages theme application and color manipulation for the extension.
 * Handles loading theme settings from storage, applying CSS variables,
 * and providing color utility functions.
 */

export interface ThemeSettings {
  accentColor?: string;
  highlightColor?: string;
}

export class ThemeManager {
  private appliedAccent: string | null = null;
  private appliedHighlight: string | null = null;
  private readonly defaultAccent = '#2563eb';
  private readonly defaultHighlight = '#ffeb3b';

  /**
   * Applies theme settings from Chrome storage to CSS variables.
   * Caches applied values to avoid unnecessary DOM updates.
   */
  async applyThemeFromSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('settings');
      const settings = result?.settings || {};
      const accent = (settings.accentColor as string) || this.defaultAccent;
      const highlight =
        (settings.highlightColor as string) || this.defaultHighlight;

      if (accent !== this.appliedAccent) {
        document.documentElement.style.setProperty(
          '--chatmarks-primary',
          accent
        );
        const darker = this.shadeColor(accent, -12);
        document.documentElement.style.setProperty(
          '--chatmarks-primary-hover',
          darker
        );
        this.appliedAccent = accent;
      }

      if (highlight !== this.appliedHighlight) {
        document.documentElement.style.setProperty(
          '--chatmarks-highlight',
          highlight
        );
        this.appliedHighlight = highlight;
      }
    } catch (error) {
      // Failed to apply theme - log error and keep defaults defined in styles.css
      console.warn('Chatmarks: Failed to apply theme from settings:', error);
    }
  }

  /**
   * Updates theme with new settings.
   *
   * @param settings - The theme settings to apply
   */
  async updateTheme(settings: ThemeSettings): Promise<void> {
    const accent = settings.accentColor || this.defaultAccent;
    const highlight = settings.highlightColor || this.defaultHighlight;

    if (accent !== this.appliedAccent) {
      document.documentElement.style.setProperty('--chatmarks-primary', accent);
      const darker = this.shadeColor(accent, -12);
      document.documentElement.style.setProperty(
        '--chatmarks-primary-hover',
        darker
      );
      this.appliedAccent = accent;
    }

    if (highlight !== this.appliedHighlight) {
      document.documentElement.style.setProperty(
        '--chatmarks-highlight',
        highlight
      );
      this.appliedHighlight = highlight;
    }
  }

  /**
   * Shades a color by a given percentage.
   * Positive percentages lighten, negative percentages darken.
   *
   * @param hex - The hex color to shade
   * @param percent - The percentage to shade (-100 to 100)
   * @returns The shaded hex color
   */
  shadeColor(hex: string, percent: number): string {
    const { r, g, b } = this.hexToRgb(hex);
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent) / 100;
    const R = Math.round((t - r) * p + r);
    const G = Math.round((t - g) * p + g);
    const B = Math.round((t - b) * p + b);
    return this.rgbToHex(R, G, B);
  }

  /**
   * Converts a hex color to RGB components.
   *
   * @param hex - The hex color string (with or without #)
   * @returns Object with r, g, b values
   */
  hexToRgb(hex: string): { r: number; g: number; b: number } {
    const normalized = hex.replace('#', '');
    const bigint = parseInt(
      normalized.length === 3
        ? normalized
            .split('')
            .map(c => c + c)
            .join('')
        : normalized,
      16
    );
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b };
  }

  /**
   * Converts RGB components to a hex color string.
   *
   * @param r - Red component (0-255)
   * @param g - Green component (0-255)
   * @param b - Blue component (0-255)
   * @returns Hex color string with # prefix
   */
  rgbToHex(r: number, g: number, b: number): string {
    return (
      '#' +
      [r, g, b]
        .map(x => {
          const h = x.toString(16);
          return h.length === 1 ? '0' + h : h;
        })
        .join('')
    );
  }

  /**
   * Gets the currently applied theme colors.
   *
   * @returns Object with current accent and highlight colors
   */
  getCurrentTheme(): { accent: string | null; highlight: string | null } {
    return {
      accent: this.appliedAccent,
      highlight: this.appliedHighlight,
    };
  }

  /**
   * Resets theme to default values.
   */
  resetToDefaults(): void {
    this.updateTheme({
      accentColor: this.defaultAccent,
      highlightColor: this.defaultHighlight,
    });
  }
}

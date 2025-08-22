/**
 * BookmarkForm Web Component
 *
 * A form component for bookmark creation and editing with the following features:
 * - Real-time validation with user feedback
 * - Accessibility compliance (WCAG 2.1 AA)
 * - Keyboard navigation and screen reader support
 * - Tag management with autocomplete
 * - Color selection for bookmark highlighting
 * - Auto-save functionality
 */

import { BaseComponent } from './base/BaseComponent';

export interface BookmarkFormData {
  note: string;
  tags: string[];
  color: string;
  selectedText: string;
}

export interface BookmarkFormOptions {
  selectedText?: string;
  existingData?: Partial<BookmarkFormData>;
  onSave?: (data: BookmarkFormData) => void;
  onCancel?: () => void;
  autoSave?: boolean;
}

export class BookmarkForm extends BaseComponent {
  static componentName = 'bookmark-form';
  static observedAttributes = ['selected-text', 'auto-save'];

  private _selectedText: string = '';
  private _autoSave: boolean = false;
  private _formData: BookmarkFormData = {
    note: '',
    tags: [],
    color: '#fbbf24', // Default amber color
    selectedText: '',
  };
  private _options: BookmarkFormOptions = {};
  private _autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private _validationState: Record<string, boolean> = {};

  // Predefined color options for highlighting
  private readonly COLOR_OPTIONS = [
    { name: 'Yellow', value: '#fbbf24', label: 'Amber highlight' },
    { name: 'Blue', value: '#3b82f6', label: 'Blue highlight' },
    { name: 'Green', value: '#10b981', label: 'Emerald highlight' },
    { name: 'Purple', value: '#8b5cf6', label: 'Violet highlight' },
    { name: 'Pink', value: '#ec4899', label: 'Pink highlight' },
    { name: 'Orange', value: '#f97316', label: 'Orange highlight' },
  ];

  // Common tags for autocomplete
  private readonly SUGGESTED_TAGS = [
    'important',
    'question',
    'idea',
    'code',
    'quote',
    'todo',
    'reference',
    'example',
    'definition',
    'insight',
  ];

  constructor() {
    super();
    this.setupFormEventListeners();
  }

  protected getTemplate(): string {
    return `
      <style>
        :host {
          display: block;
          width: 100%;
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: var(--chatmarks-text, #1f2937);
        }

        .form-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 0;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-label {
          font-weight: 500;
          color: var(--chatmarks-text, #1f2937);
          font-size: 13px;
        }

        .form-label--required::after {
          content: ' *';
          color: var(--chatmarks-error, #ef4444);
        }

        .selected-text-preview {
          background: var(--chatmarks-secondary, #f9fafb);
          border: 1px solid var(--chatmarks-border, #e5e7eb);
          border-radius: 6px;
          padding: 12px;
          font-style: italic;
          color: var(--chatmarks-text-secondary, #6b7280);
          font-size: 13px;
          max-height: 80px;
          overflow-y: auto;
          line-height: 1.4;
        }

        .selected-text-preview:empty::before {
          content: 'No text selected';
          color: var(--chatmarks-text-muted, #9ca3af);
        }

        .form-input {
          border: 1px solid var(--chatmarks-border, #e5e7eb);
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 14px;
          font-family: inherit;
          line-height: 1.5;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          background: #ffffff;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--chatmarks-primary, #2563eb);
          box-shadow: 0 0 0 2px var(--chatmarks-primary-light, rgba(37, 99, 235, 0.1));
        }

        .form-input--error {
          border-color: var(--chatmarks-error, #ef4444);
        }

        .form-input--error:focus {
          border-color: var(--chatmarks-error, #ef4444);
          box-shadow: 0 0 0 2px var(--chatmarks-error-light, rgba(239, 68, 68, 0.1));
        }

        .form-textarea {
          min-height: 80px;
          resize: vertical;
          font-family: inherit;
        }

        .character-count {
          font-size: 12px;
          color: var(--chatmarks-text-secondary, #6b7280);
          text-align: right;
          margin-top: 4px;
        }

        .character-count--warning {
          color: var(--chatmarks-warning, #f59e0b);
        }

        .character-count--error {
          color: var(--chatmarks-error, #ef4444);
        }

        .tags-container {
          position: relative;
        }

        .tags-display {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 8px;
          min-height: 28px;
          align-items: flex-start;
        }

        .tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: var(--chatmarks-primary-light, #dbeafe);
          color: var(--chatmarks-primary, #2563eb);
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .tag-remove {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          padding: 0;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s ease;
        }

        .tag-remove:hover {
          background: var(--chatmarks-primary, #2563eb);
          color: white;
        }

        .tag-input {
          min-width: 120px;
          flex: 1;
        }

        .tag-suggestions {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: #ffffff;
          border: 1px solid var(--chatmarks-border, #e5e7eb);
          border-radius: 6px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          max-height: 120px;
          overflow-y: auto;
          display: none;
        }

        .tag-suggestions--visible {
          display: block;
        }

        .tag-suggestion {
          padding: 8px 12px;
          cursor: pointer;
          font-size: 13px;
          transition: background-color 0.15s ease;
        }

        .tag-suggestion:hover,
        .tag-suggestion--selected {
          background: var(--chatmarks-hover, #f3f4f6);
        }

        .color-picker-container {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .color-option {
          width: 32px;
          height: 32px;
          border: 2px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
        }

        .color-option:hover {
          transform: scale(1.1);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .color-option--selected {
          border-color: var(--chatmarks-text, #1f2937);
          transform: scale(1.1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .color-option::after {
          content: '';
          position: absolute;
          inset: 2px;
          border-radius: 3px;
          background: var(--color);
        }

        .validation-message {
          font-size: 12px;
          margin-top: 4px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .validation-message--error {
          color: var(--chatmarks-error, #ef4444);
        }

        .validation-message--success {
          color: var(--chatmarks-success, #10b981);
        }

        .validation-icon {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
        }

        .auto-save-indicator {
          font-size: 11px;
          color: var(--chatmarks-text-secondary, #6b7280);
          font-style: italic;
          display: none;
        }

        .auto-save-indicator--saving {
          display: block;
          color: var(--chatmarks-warning, #f59e0b);
        }

        .auto-save-indicator--saved {
          display: block;
          color: var(--chatmarks-success, #10b981);
        }

        .visually-hidden {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        /* Responsive adjustments */
        @media (max-width: 480px) {
          .form-container {
            gap: 12px;
          }
          
          .color-picker-container {
            gap: 6px;
          }
          
          .color-option {
            width: 28px;
            height: 28px;
          }
        }
      </style>

      <form class="form-container" novalidate>
        <div class="form-group">
          <label class="form-label" for="selected-text">Selected Text</label>
          <div class="selected-text-preview" id="selected-text" role="textbox" aria-readonly="true"></div>
        </div>

        <div class="form-group">
          <label class="form-label form-label--required" for="note-input">Note</label>
          <textarea 
            class="form-input form-textarea" 
            id="note-input"
            placeholder="Add your note about this text..."
            aria-describedby="note-help note-count note-validation"
            maxlength="500"
            rows="3"
          ></textarea>
          <div class="character-count" id="note-count" aria-live="polite">0 / 500</div>
          <div class="validation-message" id="note-validation" role="alert" aria-live="polite"></div>
          <div id="note-help" class="visually-hidden">Enter a descriptive note for your bookmark</div>
        </div>

        <div class="form-group">
          <label class="form-label" for="tag-input">Tags</label>
          <div class="tags-container">
            <div class="tags-display" id="tags-display" role="list" aria-label="Selected tags"></div>
            <input 
              class="form-input tag-input" 
              id="tag-input"
              type="text"
              placeholder="Add tags (press Enter to add)"
              aria-describedby="tags-help"
              autocomplete="off"
            />
            <div class="tag-suggestions" id="tag-suggestions" role="listbox" aria-label="Tag suggestions"></div>
          </div>
          <div id="tags-help" class="visually-hidden">Add tags to categorize your bookmark. Press Enter to add each tag.</div>
        </div>

        <div class="form-group">
          <label class="form-label" for="color-picker">Highlight Color</label>
          <div class="color-picker-container" id="color-picker" role="radiogroup" aria-label="Choose highlight color">
            ${this.COLOR_OPTIONS.map(
              (color, index) => `
              <button 
                type="button"
                class="color-option${index === 0 ? ' color-option--selected' : ''}" 
                style="--color: ${color.value}"
                data-color="${color.value}"
                role="radio"
                aria-checked="${index === 0 ? 'true' : 'false'}"
                aria-label="${color.label}"
                tabindex="${index === 0 ? '0' : '-1'}"
              ></button>
            `
            ).join('')}
          </div>
        </div>

        <div class="auto-save-indicator" id="auto-save-status" aria-live="polite">
          Changes saved automatically
        </div>
      </form>
    `;
  }

  /**
   * Set up event listeners for form interactions and validation
   */
  private setupFormEventListeners(): void {
    requestAnimationFrame(() => {
      this.addFormEventListeners();
      this.setupValidation();
      this.setupAutoComplete();
      this.initializeForm();
    });
  }

  /**
   * Add event listeners after DOM is ready
   */
  private addFormEventListeners(): void {
    const noteInput = this.$('#note-input') as HTMLTextAreaElement;
    const tagInput = this.$('#tag-input') as HTMLInputElement;
    const colorPicker = this.$('#color-picker');

    // Note input events
    noteInput?.addEventListener('input', this.handleNoteInput.bind(this));
    noteInput?.addEventListener('blur', this.handleNoteBlur.bind(this));

    // Tag input events
    tagInput?.addEventListener('input', this.handleTagInput.bind(this));
    tagInput?.addEventListener('keydown', this.handleTagKeydown.bind(this));
    tagInput?.addEventListener('blur', this.handleTagBlur.bind(this));

    // Color picker events
    colorPicker?.addEventListener(
      'click',
      this.handleColorSelection.bind(this)
    );
    colorPicker?.addEventListener(
      'keydown',
      this.handleColorKeydown.bind(this) as EventListener
    );

    // Form submission prevention
    const form = this.$('.form-container') as HTMLFormElement;
    form?.addEventListener('submit', this.handleFormSubmit.bind(this));
  }

  /**
   * Handle note input changes with real-time validation
   */
  private handleNoteInput(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    const value = input.value.trim();
    const charCount = value.length;

    // Update character count
    const countElement = this.$('#note-count');
    if (countElement) {
      countElement.textContent = `${charCount} / 500`;
      countElement.className = `character-count${charCount > 450 ? ' character-count--warning' : ''}${charCount >= 500 ? ' character-count--error' : ''}`;
    }

    // Update form data
    this._formData.note = value;

    // Validate
    this.validateNote(value);

    // Trigger auto-save
    if (this._autoSave) {
      this.scheduleAutoSave();
    }

    // Dispatch input event
    this._event('input', { field: 'note', value, formData: this._formData });
  }

  /**
   * Handle note field blur for validation
   */
  private handleNoteBlur(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.validateNote(input.value.trim());
  }

  /**
   * Validate note field and show feedback
   */
  private validateNote(value: string): boolean {
    const validationElement = this.$('#note-validation');
    if (!validationElement) return true;

    let isValid = true;
    let message = '';
    let icon = '';

    if (value.length === 0) {
      isValid = false;
      message = 'Note is required';
      icon = '⚠️';
    } else if (value.length < 3) {
      isValid = false;
      message = 'Note must be at least 3 characters';
      icon = '⚠️';
    } else if (value.length >= 500) {
      isValid = false;
      message = 'Note is too long (maximum 500 characters)';
      icon = '⚠️';
    } else {
      message = 'Valid note';
      icon = '✓';
    }

    // Update validation display
    validationElement.innerHTML = message
      ? `<span class="validation-icon">${icon}</span>${message}`
      : '';
    validationElement.className = `validation-message${isValid ? ' validation-message--success' : ' validation-message--error'}`;

    // Update input styling
    const noteInput = this.$('#note-input');
    if (noteInput) {
      noteInput.className = `form-input form-textarea${!isValid ? ' form-input--error' : ''}`;
    }

    this._validationState.note = isValid;
    return isValid;
  }

  /**
   * Handle tag input changes and show suggestions
   */
  private handleTagInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.toLowerCase();

    if (value.length > 0) {
      this.showTagSuggestions(value);
    } else {
      this.hideTagSuggestions();
    }
  }

  /**
   * Handle tag input keydown events
   */
  private handleTagKeydown(event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    const suggestions = this.$('#tag-suggestions');

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        const value = input.value.trim();
        if (value) {
          this.addTag(value);
          input.value = '';
          this.hideTagSuggestions();
        }
        break;

      case 'ArrowDown':
        event.preventDefault();
        this.navigateTagSuggestions(1);
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.navigateTagSuggestions(-1);
        break;

      case 'Escape':
        this.hideTagSuggestions();
        break;

      case 'Backspace':
        if (input.value === '' && this._formData.tags.length > 0) {
          this.removeTag(this._formData.tags.length - 1);
        }
        break;
    }
  }

  /**
   * Handle tag input blur
   */
  private handleTagBlur(event: Event): void {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      this.hideTagSuggestions();
    }, 150);
  }

  /**
   * Add a tag to the form data and update display
   */
  private addTag(tag: string): void {
    const normalizedTag = tag.toLowerCase().trim();

    if (normalizedTag && !this._formData.tags.includes(normalizedTag)) {
      if (this._formData.tags.length < 10) {
        // Limit to 10 tags
        this._formData.tags.push(normalizedTag);
        this.updateTagsDisplay();

        if (this._autoSave) {
          this.scheduleAutoSave();
        }

        this._event('input', {
          field: 'tags',
          value: this._formData.tags,
          formData: this._formData,
        });
      }
    }
  }

  /**
   * Remove a tag from the form data
   */
  private removeTag(index: number): void {
    if (index >= 0 && index < this._formData.tags.length) {
      this._formData.tags.splice(index, 1);
      this.updateTagsDisplay();

      if (this._autoSave) {
        this.scheduleAutoSave();
      }

      this._event('input', {
        field: 'tags',
        value: this._formData.tags,
        formData: this._formData,
      });
    }
  }

  /**
   * Update the visual display of tags
   */
  private updateTagsDisplay(): void {
    const tagsDisplay = this.$('#tags-display');
    if (!tagsDisplay) return;

    tagsDisplay.innerHTML = this._formData.tags
      .map(
        (tag, index) => `
      <span class="tag" role="listitem">
        <span>${this.escapeHtml(tag)}</span>
        <button 
          type="button" 
          class="tag-remove" 
          aria-label="Remove ${tag} tag"
          data-index="${index}"
        >×</button>
      </span>
    `
      )
      .join('');

    // Add event listeners to remove buttons
    tagsDisplay.querySelectorAll('.tag-remove').forEach(button => {
      button.addEventListener('click', e => {
        const index = parseInt(
          (e.target as HTMLElement).getAttribute('data-index') || '0'
        );
        this.removeTag(index);
      });
    });
  }

  /**
   * Show tag suggestions based on input
   */
  private showTagSuggestions(input: string): void {
    const suggestions = this.$('#tag-suggestions');
    if (!suggestions) return;

    const filtered = this.SUGGESTED_TAGS.filter(
      tag => tag.includes(input) && !this._formData.tags.includes(tag)
    ).slice(0, 5);

    if (filtered.length > 0) {
      suggestions.innerHTML = filtered
        .map(
          (tag, index) => `
        <div 
          class="tag-suggestion" 
          role="option"
          aria-selected="false"
          data-tag="${tag}"
          tabindex="-1"
        >${this.escapeHtml(tag)}</div>
      `
        )
        .join('');

      suggestions.className = 'tag-suggestions tag-suggestions--visible';

      // Add click listeners
      suggestions.querySelectorAll('.tag-suggestion').forEach(item => {
        item.addEventListener('click', e => {
          const tag = (e.target as HTMLElement).getAttribute('data-tag');
          if (tag) {
            this.addTag(tag);
            const tagInput = this.$('#tag-input') as HTMLInputElement;
            if (tagInput) {
              tagInput.value = '';
              tagInput.focus();
            }
            this.hideTagSuggestions();
          }
        });
      });
    } else {
      this.hideTagSuggestions();
    }
  }

  /**
   * Hide tag suggestions dropdown
   */
  private hideTagSuggestions(): void {
    const suggestions = this.$('#tag-suggestions');
    if (suggestions) {
      suggestions.className = 'tag-suggestions';
    }
  }

  /**
   * Navigate tag suggestions with arrow keys
   */
  private navigateTagSuggestions(direction: number): void {
    const suggestions = this.$('#tag-suggestions');
    if (!suggestions) return;

    const items = Array.from(suggestions.querySelectorAll('.tag-suggestion'));
    const selected = suggestions.querySelector('.tag-suggestion--selected');
    let newIndex = 0;

    if (selected) {
      const currentIndex = items.indexOf(selected);
      newIndex = Math.max(
        0,
        Math.min(items.length - 1, currentIndex + direction)
      );
    }

    // Update selection
    items.forEach((item, index) => {
      item.className = `tag-suggestion${index === newIndex ? ' tag-suggestion--selected' : ''}`;
      item.setAttribute('aria-selected', (index === newIndex).toString());
    });
  }

  /**
   * Handle color selection
   */
  private handleColorSelection(event: Event): void {
    const target = event.target as HTMLElement;
    if (target.classList.contains('color-option')) {
      const color = target.getAttribute('data-color');
      if (color) {
        this.selectColor(color);
      }
    }
  }

  /**
   * Handle keyboard navigation in color picker
   */
  private handleColorKeydown(event: KeyboardEvent): void {
    if (
      !event.target ||
      !(event.target as HTMLElement).classList.contains('color-option')
    ) {
      return;
    }

    const colorOptions = Array.from(
      this.$('#color-picker')?.querySelectorAll('.color-option') || []
    );
    const currentIndex = colorOptions.indexOf(event.target as HTMLElement);
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        newIndex =
          currentIndex > 0 ? currentIndex - 1 : colorOptions.length - 1;
        break;

      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        newIndex =
          currentIndex < colorOptions.length - 1 ? currentIndex + 1 : 0;
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        const color = (event.target as HTMLElement).getAttribute('data-color');
        if (color) {
          this.selectColor(color);
        }
        return;
    }

    // Update focus and selection
    if (newIndex !== currentIndex) {
      colorOptions.forEach((option, index) => {
        (option as HTMLElement).tabIndex = index === newIndex ? 0 : -1;
        if (index === newIndex) {
          (option as HTMLElement).focus();
        }
      });
    }
  }

  /**
   * Select a color and update the form data
   */
  private selectColor(color: string): void {
    this._formData.color = color;

    // Update visual selection
    const colorOptions =
      this.$('#color-picker')?.querySelectorAll('.color-option');
    colorOptions?.forEach(option => {
      const isSelected = option.getAttribute('data-color') === color;
      option.className = `color-option${isSelected ? ' color-option--selected' : ''}`;
      option.setAttribute('aria-checked', isSelected.toString());
    });

    if (this._autoSave) {
      this.scheduleAutoSave();
    }

    this._event('input', {
      field: 'color',
      value: color,
      formData: this._formData,
    });
  }

  /**
   * Handle form submission prevention
   */
  private handleFormSubmit(event: Event): void {
    event.preventDefault();
    this._event('submit', this._formData);
  }

  /**
   * Set up form validation
   */
  private setupValidation(): void {
    this._validationState = {
      note: false,
    };
  }

  /**
   * Set up autocomplete functionality
   */
  private setupAutoComplete(): void {
    // Already handled in event listeners
  }

  /**
   * Initialize form with default values
   */
  private initializeForm(): void {
    // Set selected text
    if (this._selectedText) {
      const preview = this.$('#selected-text');
      if (preview) {
        preview.textContent = this._selectedText;
      }
      this._formData.selectedText = this._selectedText;
    }

    // Initialize color selection
    this.selectColor(this._formData.color);
  }

  /**
   * Schedule auto-save operation
   */
  private scheduleAutoSave(): void {
    if (this._autoSaveTimer) {
      clearTimeout(this._autoSaveTimer);
    }

    const indicator = this.$('#auto-save-status');
    if (indicator) {
      indicator.className = 'auto-save-indicator auto-save-indicator--saving';
      indicator.textContent = 'Saving...';
    }

    this._autoSaveTimer = setTimeout(() => {
      this.performAutoSave();
    }, 1000); // Save after 1 second of inactivity
  }

  /**
   * Perform auto-save operation
   */
  private performAutoSave(): void {
    if (this.isValid()) {
      this._event('autosave', this._formData);

      const indicator = this.$('#auto-save-status');
      if (indicator) {
        indicator.className = 'auto-save-indicator auto-save-indicator--saved';
        indicator.textContent = 'Changes saved automatically';

        setTimeout(() => {
          indicator.className = 'auto-save-indicator';
        }, 2000);
      }
    }
  }

  /**
   * Get current form data
   */
  getFormData(): BookmarkFormData {
    return { ...this._formData };
  }

  /**
   * Set form data programmatically
   */
  setFormData(data: Partial<BookmarkFormData>): void {
    if (data.note !== undefined) {
      this._formData.note = data.note;
      const noteInput = this.$('#note-input') as HTMLTextAreaElement;
      if (noteInput) {
        noteInput.value = data.note;
        this.handleNoteInput({ target: noteInput } as any);
      }
    }

    if (data.tags !== undefined) {
      this._formData.tags = [...data.tags];
      this.updateTagsDisplay();
    }

    if (data.color !== undefined) {
      this.selectColor(data.color);
    }

    if (data.selectedText !== undefined) {
      this._formData.selectedText = data.selectedText;
      const preview = this.$('#selected-text');
      if (preview) {
        preview.textContent = data.selectedText;
      }
    }
  }

  /**
   * Validate the entire form
   */
  isValid(): boolean {
    const noteValid = this.validateNote(this._formData.note);
    return noteValid && this._formData.selectedText.length > 0;
  }

  /**
   * Reset form to initial state
   */
  reset(): void {
    this._formData = {
      note: '',
      tags: [],
      color: '#fbbf24',
      selectedText: this._selectedText,
    };

    const noteInput = this.$('#note-input') as HTMLTextAreaElement;
    if (noteInput) {
      noteInput.value = '';
      this.handleNoteInput({ target: noteInput } as any);
    }

    const tagInput = this.$('#tag-input') as HTMLInputElement;
    if (tagInput) {
      tagInput.value = '';
    }

    this.updateTagsDisplay();
    this.selectColor('#fbbf24');
    this.hideTagSuggestions();

    this._event('reset');
  }

  /**
   * Utility method to escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get selected text property
   */
  get selectedText(): string {
    return this._selectedText;
  }

  /**
   * Set selected text property
   */
  set selectedText(value: string) {
    if (this._selectedText === value) return;

    this._selectedText = value;
    this._formData.selectedText = value;

    const preview = this.$('#selected-text');
    if (preview) {
      preview.textContent = value;
    }

    this.setAttribute('selected-text', value);
  }

  /**
   * Get auto-save property
   */
  get autoSave(): boolean {
    return this._autoSave;
  }

  /**
   * Set auto-save property
   */
  set autoSave(value: boolean) {
    if (this._autoSave === value) return;

    this._autoSave = value;

    if (value) {
      this.setAttribute('auto-save', '');
    } else {
      this.removeAttribute('auto-save');
    }
  }

  /**
   * Handle attribute changes
   */
  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    super.attributeChangedCallback(name, oldValue, newValue);

    switch (name) {
      case 'selected-text':
        if (newValue !== null) {
          this._selectedText = newValue;
          this._formData.selectedText = newValue;
          const preview = this.$('#selected-text');
          if (preview) {
            preview.textContent = newValue;
          }
        }
        break;

      case 'auto-save':
        this._autoSave = newValue !== null;
        break;
    }
  }

  /**
   * Cleanup when component is disconnected
   */
  protected cleanup(): void {
    super.cleanup();

    if (this._autoSaveTimer) {
      clearTimeout(this._autoSaveTimer);
      this._autoSaveTimer = null;
    }
  }
}

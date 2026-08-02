import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface MaterialSelectOption<T extends string = string> {
  value: T;
  label: ReactNode;
  searchText?: string;
  disabled?: boolean;
}

interface MaterialSelectProps<T extends string> {
  value: T;
  options: MaterialSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  style?: CSSProperties;
  compact?: boolean;
  disabled?: boolean;
  title?: string;
}

interface MenuPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  openAbove: boolean;
}

export function MaterialSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
  style,
  compact = false,
  disabled = false,
  title,
}: MaterialSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const typeaheadRef = useRef('');
  const typeaheadTimerRef = useRef<number | null>(null);
  const listboxId = useId();
  const selectedOption = options[selectedIndex];

  const enabledIndices = useMemo(
    () => options.map((option, index) => (option.disabled ? -1 : index)).filter((index) => index >= 0),
    [options],
  );

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const menuGap = 8;
    const desiredHeight = Math.min(options.length * 52 + 16, 320);
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openAbove = spaceBelow < Math.min(desiredHeight, 220) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(desiredHeight, openAbove ? spaceAbove - menuGap : spaceBelow - menuGap));
    const width = Math.min(Math.max(rect.width, 180), window.innerWidth - viewportPadding * 2);
    const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - width - viewportPadding);
    const top = openAbove
      ? Math.max(viewportPadding, rect.top - maxHeight - menuGap)
      : rect.bottom + menuGap;

    setMenuPosition({ left, top, width, maxHeight, openAbove });
  }, [options.length]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    setHighlightedIndex(selectedIndex);
    updateMenuPosition();
  }, [isOpen, selectedIndex, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setIsOpen(false);
    };
    const handleViewportChange = () => updateMenuPosition();

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen, updateMenuPosition]);

  useEffect(() => () => {
    if (typeaheadTimerRef.current) window.clearTimeout(typeaheadTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    menuRef.current?.querySelector<HTMLElement>(`[data-option-index="${highlightedIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  const moveHighlight = (direction: 1 | -1) => {
    if (!enabledIndices.length) return;
    const currentPosition = enabledIndices.indexOf(highlightedIndex);
    const nextPosition = currentPosition < 0
      ? 0
      : (currentPosition + direction + enabledIndices.length) % enabledIndices.length;
    setHighlightedIndex(enabledIndices[nextPosition]);
  };

  const selectOption = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setHighlightedIndex(index);
    setIsOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement | HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) setIsOpen(true);
      else moveHighlight(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Home' && isOpen) {
      event.preventDefault();
      if (enabledIndices.length) setHighlightedIndex(enabledIndices[0]);
      return;
    }
    if (event.key === 'End' && isOpen) {
      event.preventDefault();
      if (enabledIndices.length) setHighlightedIndex(enabledIndices[enabledIndices.length - 1]);
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && isOpen) {
      event.preventDefault();
      selectOption(highlightedIndex);
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && !isOpen) {
      event.preventDefault();
      setIsOpen(true);
      return;
    }
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === 'Tab') {
      setIsOpen(false);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      typeaheadRef.current += event.key.toLocaleLowerCase();
      if (typeaheadTimerRef.current) window.clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = window.setTimeout(() => { typeaheadRef.current = ''; }, 500);
      const match = options.findIndex((option) => {
        if (option.disabled) return false;
        const text = option.searchText || (typeof option.label === 'string' ? option.label : '');
        return text.toLocaleLowerCase().startsWith(typeaheadRef.current);
      });
      if (match >= 0) {
        event.preventDefault();
        if (isOpen) setHighlightedIndex(match);
        else selectOption(match);
      }
    }
  };

  return (
    <div
      ref={rootRef}
      className={`material-select ${compact ? 'material-select--compact' : ''} ${isOpen ? 'is-open' : ''} ${className}`.trim()}
      style={style}
    >
      <button
        ref={triggerRef}
        type="button"
        className="material-select__trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        disabled={disabled}
        title={title}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleKeyDown}
      >
        <span className="material-select__value">{selectedOption?.label ?? value}</span>
        <span className="material-select__chevron" aria-hidden="true"><ChevronDown size={18} /></span>
      </button>

      {isOpen && menuPosition && createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          className={`material-select__menu ${menuPosition.openAbove ? 'opens-above' : ''}`}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          style={{
            left: menuPosition.left,
            top: menuPosition.top,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
          }}
          onKeyDown={handleKeyDown}
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            const highlighted = index === highlightedIndex;
            return (
              <button
                type="button"
                key={option.value}
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                data-option-index={index}
                className={`material-select__option ${selected ? 'is-selected' : ''} ${highlighted ? 'is-highlighted' : ''}`}
                onPointerMove={() => !option.disabled && setHighlightedIndex(index)}
                onClick={() => selectOption(index)}
              >
                <span className="material-select__option-label">{option.label}</span>
                <span className="material-select__check" aria-hidden="true"><Check size={18} strokeWidth={2.5} /></span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}

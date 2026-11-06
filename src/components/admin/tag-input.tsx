"use client";

import { useId, useMemo, useRef, useState } from "react";

type Props = {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Known tags offered as completions. */
  suggestions?: string[];
  placeholder?: string;
  id?: string;
  compact?: boolean;
};

function clean(raw: string): string {
  return raw.trim().toLowerCase().replace(/[,\s]+/g, "");
}

/**
 * Recipient-style tag field: type, press Space, Enter or comma to turn the word
 * into a chip; Backspace on an empty field removes the last chip; known tags
 * appear beneath as you type, Arrow keys and Enter (or Tab) pick one.
 */
export function TagInput({ value, onChange, suggestions = [], placeholder, id, compact }: Props) {
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const q = clean(text);
  const matches = useMemo(() => {
    if (!q) return [];
    const have = new Set(value);
    const starts = suggestions.filter((t) => !have.has(t) && t.startsWith(q));
    const contains = suggestions.filter((t) => !have.has(t) && !t.startsWith(q) && t.includes(q));
    return [...starts, ...contains].slice(0, 8);
  }, [q, suggestions, value]);

  const add = (raw: string) => {
    const t = clean(raw);
    if (!t) return;
    if (!value.includes(t)) onChange([...value, t]);
    setText("");
    setActive(0);
  };

  const remove = (t: string) => onChange(value.filter((x) => x !== t));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === " " || e.key === "," || e.key === "Enter" || (e.key === "Tab" && q)) {
      e.preventDefault();
      if (open && matches.length && (e.key === "Enter" || e.key === "Tab")) add(matches[active] ?? text);
      else add(text);
      return;
    }
    if (e.key === "Backspace" && !text && value.length) {
      e.preventDefault();
      remove(value[value.length - 1]);
      return;
    }
    if (e.key === "ArrowDown" && matches.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % matches.length);
    } else if (e.key === "ArrowUp" && matches.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + matches.length) % matches.length);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && matches.length > 0;

  return (
    <div className={`tagin${compact ? " tagin-compact" : ""}`} onClick={() => inputRef.current?.focus()}>
      {value.map((t) => (
        <span key={t} className="tagin-chip">
          {t}
          <button type="button" aria-label={`Remove tag ${t}`} onClick={() => remove(t)} tabIndex={-1}>
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={text}
        placeholder={value.length ? "" : placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Commit what was typed so a click elsewhere never loses a tag.
          setTimeout(() => {
            setOpen(false);
            if (clean(text)) add(text);
          }, 120);
        }}
      />
      {showList && (
        <ul className="tagin-list" id={listId} role="listbox">
          {matches.map((t, i) => (
            <li
              key={t}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              data-active={i === active ? "" : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                add(t);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

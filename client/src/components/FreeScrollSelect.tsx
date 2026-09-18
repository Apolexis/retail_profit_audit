import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type FreeScrollSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string | null;
};

type FreeScrollSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  options: FreeScrollSelectOption[];
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: React.AriaAttributes["aria-invalid"];
};

/**
 * A non-modal select menu. Unlike Radix Select, opening this list does not lock
 * document scrolling; a page scroll simply closes the transient menu.
 */
export function FreeScrollSelect({
  value,
  onValueChange,
  placeholder,
  options,
  searchable = false,
  searchPlaceholder = "Поиск в списке",
  className,
  contentClassName,
  disabled = false,
  ariaLabel,
  ariaDescribedBy,
  ariaInvalid,
}: FreeScrollSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollFrame = useRef<number | null>(null);
  const listId = useId();
  const selected = options.find(option => option.value === value);
  const normalizedSearch = search.trim().toLocaleLowerCase("ru-RU");
  const visibleOptions = normalizedSearch
    ? options.filter(option => option.label.toLocaleLowerCase("ru-RU").includes(normalizedSearch))
    : options;
  const [canScroll, setCanScroll] = useState({ up: false, down: false });

  const updateScrollAvailability = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setCanScroll({
      up: viewport.scrollTop > 1,
      down: viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 1,
    });
  }, []);

  const stopEdgeScroll = useCallback(() => {
    if (scrollFrame.current !== null) {
      window.cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = null;
    }
  }, []);

  const startEdgeScroll = useCallback((direction: -1 | 1) => {
    stopEdgeScroll();
    const move = () => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const before = viewport.scrollTop;
      viewport.scrollTop += direction * 9;
      updateScrollAvailability();
      if (Math.abs(viewport.scrollTop - before) > 0.1) scrollFrame.current = window.requestAnimationFrame(move);
      else scrollFrame.current = null;
    };
    scrollFrame.current = window.requestAnimationFrame(move);
  }, [stopEdgeScroll, updateScrollAvailability]);

  useLayoutEffect(() => {
    if (!open) return;
    const closeOnDocumentScroll = (event: Event) => {
      if (event.target instanceof Node && contentRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", closeOnDocumentScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", closeOnDocumentScroll, true);
  }, [open]);

  useEffect(() => () => stopEdgeScroll(), [stopEdgeScroll]);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    const frame = window.requestAnimationFrame(updateScrollAvailability);
    return () => window.cancelAnimationFrame(frame);
  }, [open, visibleOptions.length, updateScrollAvailability]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-slot="select-trigger"
          data-state={open ? "open" : "closed"}
          data-placeholder={!selected ? "" : undefined}
          className={cn("free-scroll-select-trigger", className)}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
        >
          <span data-slot="select-value">{selected?.label ?? placeholder}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      {open && <PopoverContent
        ref={contentRef}
        id={listId}
        role="listbox"
        align="start"
        sideOffset={0}
        collisionPadding={12}
        className={cn("free-scroll-select-content", contentClassName)}
      >
        {searchable && <label className="free-scroll-select-search"><span className="sr-only">{searchPlaceholder}</span><input autoFocus value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => event.stopPropagation()} placeholder={searchPlaceholder}/></label>}
        <button
          type="button"
          tabIndex={canScroll.up ? 0 : -1}
          className={`free-scroll-select-edge free-scroll-select-edge-up${canScroll.up ? " is-active" : ""}`}
          aria-label="Прокрутить список вверх"
          aria-hidden={!canScroll.up}
          onPointerEnter={() => startEdgeScroll(-1)}
          onPointerLeave={stopEdgeScroll}
          onFocus={() => startEdgeScroll(-1)}
          onBlur={stopEdgeScroll}
          onClick={() => viewportRef.current?.scrollBy({ top: -72, behavior: "smooth" })}
        >
          <ChevronUp size={15} aria-hidden="true" />
        </button>
        <div ref={viewportRef} className="free-scroll-select-viewport" onScroll={updateScrollAvailability}>
          {visibleOptions.map((option, index) => (
            <div key={`${option.group ?? "base"}-${option.value}-${index}`}>
              {option.group && !visibleOptions.slice(0, index).some(previous => previous.group === option.group) && <span className="free-scroll-select-group">{option.group}</span>}
              <button
                type="button"
                role="option"
                data-slot="select-item"
                data-state={option.value === value ? "checked" : "unchecked"}
                aria-selected={option.value === value}
                disabled={option.disabled}
                onClick={() => {
                  onValueChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {option.value === value && <Check size={15} aria-hidden="true" />}
              </button>
            </div>
          ))}
          {!visibleOptions.length && <p className="free-scroll-select-empty">Совпадений нет</p>}
        </div>
        <button
          type="button"
          tabIndex={canScroll.down ? 0 : -1}
          className={`free-scroll-select-edge free-scroll-select-edge-down${canScroll.down ? " is-active" : ""}`}
          aria-label="Прокрутить список вниз"
          aria-hidden={!canScroll.down}
          onPointerEnter={() => startEdgeScroll(1)}
          onPointerLeave={stopEdgeScroll}
          onFocus={() => startEdgeScroll(1)}
          onBlur={stopEdgeScroll}
          onClick={() => viewportRef.current?.scrollBy({ top: 72, behavior: "smooth" })}
        >
          <ChevronDown size={15} aria-hidden="true" />
        </button>
      </PopoverContent>}
    </Popover>
  );
}

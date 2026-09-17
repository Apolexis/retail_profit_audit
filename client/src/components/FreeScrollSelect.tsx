import { Check, ChevronDown } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";
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
  className,
  contentClassName,
  disabled = false,
  ariaLabel,
  ariaDescribedBy,
  ariaInvalid,
}: FreeScrollSelectProps) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find(option => option.value === value);

  useLayoutEffect(() => {
    if (!open) return;
    const closeOnDocumentScroll = (event: Event) => {
      if (event.target instanceof Node && contentRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", closeOnDocumentScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", closeOnDocumentScroll, true);
  }, [open]);

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
        sideOffset={5}
        collisionPadding={12}
        className={cn("free-scroll-select-content", contentClassName)}
      >
        {options.map((option, index) => (
          <div key={`${option.group ?? "base"}-${option.value}-${index}`}>
            {option.group && !options.slice(0, index).some(previous => previous.group === option.group) && <span className="free-scroll-select-group">{option.group}</span>}
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
      </PopoverContent>}
    </Popover>
  );
}
